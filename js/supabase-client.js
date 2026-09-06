/**
 * Supabase Client Integration Module
 * 
 * Manages Supabase connection, payment screenshot (SS proof) uploads
 * to Supabase Storage ('payment-proofs' bucket), and persisting verification
 * details to the Supabase Database ('payment_verifications' table).
 */

(function () {
  const STORAGE_URL_KEY = 'ACADEMY_SUPABASE_URL';
  const STORAGE_KEY_KEY = 'ACADEMY_SUPABASE_ANON_KEY';

  class SupabaseService {
    constructor() {
      this.client = null;
      this.url = '';
      this.anonKey = '';
      this.bucket = 'payment-proofs';
      this.table = 'payment_verifications';

      this.init();
    }

    init() {
      // 1. Resolve configuration from meta tags, config.js, or localStorage
      const metaUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content');
      const metaAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content');
      
      const storedUrl = window.localStorage?.getItem(STORAGE_URL_KEY);
      const storedKey = window.localStorage?.getItem(STORAGE_KEY_KEY);

      const config = window.SUPABASE_CONFIG || {};

      this.url = (window.SUPABASE_URL || metaUrl || storedUrl || config.url || '').trim();
      this.anonKey = (window.SUPABASE_ANON_KEY || metaAnonKey || storedKey || config.anonKey || '').trim();
      this.bucket = config.bucket || 'payment-proofs';
      this.table = config.tableName || 'payment_verifications';

      // 2. Initialize client if supabase-js library is available and credentials provided
      if (window.supabase && this.url && this.anonKey) {
        try {
          this.client = window.supabase.createClient(this.url, this.anonKey);
          console.log('✓ Supabase client initialized successfully.');
        } catch (e) {
          console.error('Failed to initialize Supabase client:', e);
          this.client = null;
        }
      }
    }

    isConfigured() {
      return !!(this.client && this.url && this.anonKey);
    }

    /**
     * Update and re-initialize Supabase credentials
     */
    setCredentials(url, anonKey) {
      this.url = (url || '').trim();
      this.anonKey = (anonKey || '').trim();

      if (this.url) localStorage.setItem(STORAGE_URL_KEY, this.url);
      if (this.anonKey) localStorage.setItem(STORAGE_KEY_KEY, this.anonKey);

      if (window.supabase && this.url && this.anonKey) {
        this.client = window.supabase.createClient(this.url, this.anonKey);
        return true;
      }
      return false;
    }

    /**
     * Convert Data URL / Base64 to binary Blob
     */
    dataURItoBlob(dataURI) {
      const parts = dataURI.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const byteString = atob(parts[1]);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }

      return new Blob([arrayBuffer], { type: mime });
    }

    /**
     * Upload screenshot payment proof to Supabase Storage bucket
     * @param {string} base64OrUrl - Image data
     * @param {string} discordId - Discord snowflake ID
     * @returns {Promise<string>} Public URL of uploaded receipt
     */
    async uploadReceipt(base64OrUrl, discordId = 'guest') {
      if (!this.isConfigured()) {
        console.warn('Supabase not configured; skipping Supabase Storage upload.');
        return base64OrUrl;
      }

      // If it's already an external HTTP link, return it
      if (base64OrUrl.startsWith('http://') || base64OrUrl.startsWith('https://')) {
        return base64OrUrl;
      }

      try {
        const blob = this.dataURItoBlob(base64OrUrl);
        const ext = blob.type.split('/')[1] || 'png';
        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const fileName = `receipts/${timestamp}_${discordId}_${rand}.${ext}`;

        const { data, error } = await this.client.storage
          .from(this.bucket)
          .upload(fileName, blob, {
            contentType: blob.type,
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Supabase storage upload error:', error);
          throw error;
        }

        // Get public URL
        const { data: publicData } = this.client.storage
          .from(this.bucket)
          .getPublicUrl(data.path);

        console.log('✓ Receipt uploaded to Supabase Storage:', publicData.publicUrl);
        return publicData.publicUrl;
      } catch (err) {
        console.error('Failed to upload proof screenshot to Supabase Storage:', err);
        // Return original if storage upload failed
        return base64OrUrl;
      }
    }

    /**
     * Insert complete payment verification details into Supabase Table
     * @param {Object} verificationData
     */
    async saveVerificationRecord(verificationData) {
      if (!this.isConfigured()) {
        console.warn('Supabase not configured; skipping Supabase Database insert.');
        return null;
      }

      try {
        const record = {
          student_name: verificationData.studentName || 'Student',
          phone_number: verificationData.phoneNumber || '',
          email: verificationData.email || '',
          discord_id: verificationData.discordId || null,
          discord_username: verificationData.discordUsername || '',
          is_discord_verified: !!verificationData.isDiscordVerified,
          plan_name: verificationData.planName || 'Monthly All-Access Subscription',
          tier_number: Number(verificationData.tierNumber) || 1,
          amount: Number(verificationData.amount) || 1000,
          currency: verificationData.currency || 'NPR',
          payment_method: verificationData.paymentMethod || 'Direct Transfer',
          transaction_id: verificationData.transactionId || '',
          proof_url: verificationData.proofUrl || '',
          notes: verificationData.notes || null,
          status: 'pending', // 'pending' | 'verified' | 'rejected'
          created_at: new Date().toISOString(),
        };

        const { data, error } = await this.client
          .from(this.table)
          .insert([record])
          .select();

        if (error) {
          console.error('Supabase database insert error:', error);
          throw error;
        }

        console.log('✓ Payment verification details saved to Supabase:', data);
        return data ? data[0] : null;
      } catch (err) {
        console.error('Failed to save record to Supabase DB:', err);
        throw err;
      }
    }

    /**
     * Fetch user payment records from Supabase for a verified Discord ID or username
     * @param {string} discordId
     */
    async fetchUserVerifications(discordId) {
      if (!this.isConfigured() || !discordId) return [];

      try {
        const idStr = String(discordId).trim();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .or(`discord_id.eq.${idStr},discord_username.eq.${idStr}`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Could not fetch verifications from Supabase:', err);
        return [];
      }
    }

    /**
     * Helper to compute user's subscription and verification state
     * @param {string} discordId
     * @returns {Promise<Object>}
     */
    async getUserSubscriptionState(discordId) {
      if (!this.isConfigured() || !discordId) {
        return { status: 'none', records: [] };
      }

      const records = await this.fetchUserVerifications(discordId);
      if (!records || records.length === 0) {
        return { status: 'none', records: [] };
      }

      // 1. Check for pending record
      const pendingRecord = records.find((r) => r.status === 'pending');

      // 2. Check for approved/verified records
      const approvedRecord = records.find((r) =>
        ['verified', 'approved', 'accepted'].includes(String(r.status || '').toLowerCase())
      );

      // 3. If approved record exists, calculate validity and renewal window
      if (approvedRecord) {
        const approvedTime = new Date(approvedRecord.reviewed_at || approvedRecord.created_at).getTime();
        const durationDays = Number(approvedRecord.access_duration_days) || 30;
        const expiresAt = approvedTime + durationDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const diffMs = expiresAt - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays > 3) {
          // ACTIVE: Membership active with > 3 days remaining. Duplicate payments strictly locked!
          return {
            status: 'active',
            record: approvedRecord,
            pendingRecord: pendingRecord || null,
            expiresAt,
            diffDays,
            canRenew: false,
            records,
          };
        } else if (diffDays > 0) {
          // RENEWAL WINDOW: 3 days or fewer remaining
          if (pendingRecord) {
            return {
              status: 'pending',
              record: pendingRecord,
              approvedRecord,
              expiresAt,
              diffDays,
              canRenew: false,
              records,
            };
          }
          return {
            status: 'renewal_available',
            record: approvedRecord,
            expiresAt,
            diffDays,
            canRenew: true,
            records,
          };
        } else {
          // EXPIRED
          if (pendingRecord) {
            return {
              status: 'pending',
              record: pendingRecord,
              approvedRecord,
              expiresAt,
              diffDays: 0,
              canRenew: false,
              records,
            };
          }
          return {
            status: 'expired',
            record: approvedRecord,
            expiresAt,
            diffDays: 0,
            canRenew: true,
            records,
          };
        }
      }

      // 4. Pending only (no approved record)
      if (pendingRecord) {
        return {
          status: 'pending',
          record: pendingRecord,
          records,
        };
      }

      // 5. Rejected
      const rejectedRecord = records.find((r) => r.status === 'rejected');
      if (rejectedRecord) {
        return {
          status: 'rejected',
          record: rejectedRecord,
          records,
        };
      }

      return {
        status: 'none',
        records,
      };
    }
  }

  // Export singleton to global scope
  window.SupabaseService = new SupabaseService();
})();
