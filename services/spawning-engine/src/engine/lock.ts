import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { log } from "../logger.js";
import * as os from "os";
import * as crypto from "crypto";

const LOCK_TIMEOUT_SECONDS = 30;
const HEARTBEAT_INTERVAL_MS = 10000;

/**
 * Database-based singleton lock for the Spawning Engine.
 * Ensures only one instance runs at a time, even across multiple machines.
 */
export class EngineLock {
  private client: SupabaseClient;
  private holderId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isHolding = false;

  constructor() {
    this.client = createClient(config.supabaseUrl, config.supabaseKey);
    // Unique ID: hostname + random suffix
    this.holderId = `${os.hostname()}-${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Try to acquire the lock. Returns true if successful.
   * The lock is acquired if:
   * - No one holds it (holder_id is null)
   * - OR the previous holder's heartbeat expired
   */
  async acquire(): Promise<boolean> {
    const now = new Date().toISOString();
    const expiredThreshold = new Date(Date.now() - LOCK_TIMEOUT_SECONDS * 1000).toISOString();

    // First, check current lock state
    const { data: current } = await this.client
      .from("engine_lock")
      .select("holder_id, last_heartbeat")
      .eq("id", 1)
      .single();

    if (!current) {
      log.error("Lock row not found in database");
      return false;
    }

    // Check if lock is available
    const isAvailable =
      current.holder_id === null ||
      (current.last_heartbeat && new Date(current.last_heartbeat) < new Date(expiredThreshold));

    if (!isAvailable) {
      log.error(
        `Lock held by ${current.holder_id} (heartbeat: ${current.last_heartbeat}). ` +
        `Will become available after ${LOCK_TIMEOUT_SECONDS}s of inactivity.`
      );
      return false;
    }

    // Try to claim the lock
    // Use the previous holder_id as condition to prevent race conditions
    const baseQuery = this.client
      .from("engine_lock")
      .update({
        holder_id: this.holderId,
        acquired_at: now,
        last_heartbeat: now,
      })
      .eq("id", 1);

    // Handle null vs non-null holder_id (Supabase needs .is() for null checks)
    const { data, error } = current.holder_id === null
      ? await baseQuery.is("holder_id", null).select().maybeSingle()
      : await baseQuery.eq("holder_id", current.holder_id).select().maybeSingle();

    if (error) {
      log.error(`Failed to acquire lock: ${error.message}`);
      return false;
    }

    if (data) {
      this.isHolding = true;
      log.info(`Lock acquired (holder: ${this.holderId})`);
      this.startHeartbeat();
      return true;
    }

    // Someone else claimed it between our check and update
    log.error("Lock was claimed by another instance during acquisition");
    return false;
  }

  /**
   * Start the heartbeat to keep the lock alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.isHolding) return;

      const { error } = await this.client
        .from("engine_lock")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("id", 1)
        .eq("holder_id", this.holderId);

      if (error) {
        log.error(`Heartbeat failed: ${error.message}`);
      } else {
        log.debug("Heartbeat sent");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Release the lock (on shutdown)
   */
  async release(): Promise<void> {
    if (!this.isHolding) return;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const { error } = await this.client
      .from("engine_lock")
      .update({
        holder_id: null,
        acquired_at: null,
        last_heartbeat: null,
      })
      .eq("id", 1)
      .eq("holder_id", this.holderId);

    if (error) {
      log.error(`Failed to release lock: ${error.message}`);
    } else {
      log.info("Lock released");
    }

    this.isHolding = false;
  }

  /**
   * Check if we still hold the lock
   */
  async stillHolding(): Promise<boolean> {
    const { data } = await this.client
      .from("engine_lock")
      .select("holder_id")
      .eq("id", 1)
      .single();

    return data?.holder_id === this.holderId;
  }
}
