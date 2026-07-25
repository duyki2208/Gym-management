/**
 * Queue Service - Bộ Quản lý Hàng đợi & Tác vụ Ngầm (Background Task Queue)
 * Giúp offload các tác vụ tốn thời gian (gửi SMS Zalo, gửi Email, ghi log nặng) 
 * ra khỏi HTTP request-response loop ➔ API trả kết quả cực nhanh (< 50ms).
 */

const { EventEmitter } = require("events");

class QueueService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.workers = new Map(); // Registered worker handlers for each job type
    this.isProcessing = false;
    this.completedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Đăng ký worker xử lý cho 1 loại job cụ thể
   * @param {string} jobType 
   * @param {Function} handlerAsyncFn (payload) => Promise<any>
   */
  registerWorker(jobType, handlerAsyncFn) {
    this.workers.set(jobType, handlerAsyncFn);
    console.log(`🤖 [QueueService] Đã đăng ký Background Worker cho tác vụ: [${jobType}]`);
  }

  /**
   * Đẩy một job mới vào hàng đợi
   * @param {string} jobType Loại tác vụ (e.g. 'ZALO_NOTIFICATION', 'EMAIL_ALERT')
   * @param {object} payload Dữ liệu truyền vào tác vụ
   * @param {object} options Options bổ sung (e.g. maxRetries)
   */
  enqueue(jobType, payload, options = {}) {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: jobType,
      payload,
      maxRetries: options.maxRetries || 3,
      attempts: 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    setImmediate(() => this.processNext());
    return job.id;
  }

  /**
   * Thực thi các job trong hàng đợi
   */
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();
    const worker = this.workers.get(job.type);

    if (!worker) {
      console.warn(`⚠️ [QueueService] Chưa có worker đăng ký cho tác vụ: [${job.type}]. Bỏ qua.`);
      this.isProcessing = false;
      return this.processNext();
    }

    try {
      job.attempts += 1;
      await worker(job.payload);
      this.completedCount += 1;
      // Job thành công
    } catch (err) {
      console.error(`❌ [QueueService] Lỗi xử lý job [${job.type}] (Lần thử ${job.attempts}/${job.maxRetries}):`, err.message);

      if (job.attempts < job.maxRetries) {
        // Thử lại sau delay exponential backoff (e.g. 1s, 2s, 4s...)
        const delayMs = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => {
          this.queue.push(job);
          this.processNext();
        }, delayMs);
      } else {
        this.failedCount += 1;
        console.error(`💥 [QueueService] Job [${job.type}] (ID: ${job.id}) đã thất bại sau ${job.maxRetries} lần thử.`);
      }
    } finally {
      this.isProcessing = false;
      // Tiếp tục xử lý job kế tiếp nếu còn trong hàng đợi
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  /**
   * Lấy thống kê hàng đợi hiện tại
   */
  getStats() {
    return {
      pendingJobs: this.queue.length,
      isProcessing: this.isProcessing,
      completedJobs: this.completedCount,
      failedJobs: this.failedCount,
      registeredWorkers: Array.from(this.workers.keys()),
    };
  }
}

const queueService = new QueueService();

// Tự động đăng ký Worker mặc định cho Zalo Notification
const { sendZaloNotification } = require("./zaloService");
queueService.registerWorker("ZALO_NOTIFICATION", async (payload) => {
  return await sendZaloNotification(payload);
});

module.exports = queueService;
