const PQueue = require('p-queue').default;
const { accountQueries, statsQueries } = require('./database');
const EventEmitter = require('events');

class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.concurrency = options.concurrency || 10; // 10 workers en parallèle
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 secondes

    // Queue
    this.queue = new PQueue({
      concurrency: this.concurrency,
      timeout: 60000, // 1 minute max par job
      throwOnTimeout: true
    });

    // Stats
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      running: 0,
      startTime: null,
      endTime: null
    };

    // Job results
    this.results = {
      success: [],
      errors: []
    };

    // Active jobs tracking
    this.activeJobs = new Map();
  }

  // Ajouter un job à la queue
  addJob(account, scrapeFunction) {
    this.stats.total++;
    this.stats.pending++;

    const jobId = `${account.platform}-${account.id}`;

    const job = async () => {
      this.stats.pending--;
      this.stats.running++;
      this.activeJobs.set(jobId, {
        account,
        startTime: Date.now(),
        attempts: 0
      });

      this.emit('job:start', { jobId, account });

      try {
        const result = await this.executeWithRetry(account, scrapeFunction);

        this.stats.running--;
        this.stats.completed++;
        this.results.success.push({
          account,
          result,
          timestamp: new Date()
        });

        this.activeJobs.delete(jobId);
        this.emit('job:complete', { jobId, account, result });

        return result;
      } catch (error) {
        this.stats.running--;
        this.stats.failed++;
        this.results.errors.push({
          account,
          error: error.message,
          timestamp: new Date()
        });

        this.activeJobs.delete(jobId);
        this.emit('job:error', { jobId, account, error });

        throw error;
      }
    };

    return this.queue.add(job);
  }

  // Exécuter un job avec retry
  async executeWithRetry(account, scrapeFunction) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const jobId = `${account.platform}-${account.id}`;
        const jobInfo = this.activeJobs.get(jobId);
        if (jobInfo) {
          jobInfo.attempts = attempt;
        }

        this.emit('job:attempt', { account, attempt });

        const result = await scrapeFunction(account);
        return result;

      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts) {
          console.log(`⚠️ Tentative ${attempt}/${this.retryAttempts} échouée pour ${account.platform} @${account.username}, retry...`);
          await this.sleep(this.retryDelay * attempt); // Backoff exponentiel
        }
      }
    }

    throw lastError;
  }

  // Ajouter tous les comptes à la queue
  async queueAllAccounts(scrapeFunction) {
    const accounts = accountQueries.getAll.all();

    console.log(`\n🚀 Ajout de ${accounts.length} comptes à la queue...`);
    console.log(`⚙️ Concurrence: ${this.concurrency} workers parallèles\n`);

    this.stats.startTime = Date.now();
    this.results.success = [];
    this.results.errors = [];

    // Ajouter tous les jobs
    const jobs = accounts.map(account => this.addJob(account, scrapeFunction));

    // Attendre que tous les jobs se terminent
    await Promise.allSettled(jobs);

    this.stats.endTime = Date.now();

    return this.getResults();
  }

  // Obtenir les résultats
  getResults() {
    const duration = this.stats.endTime - this.stats.startTime;

    return {
      stats: {
        ...this.stats,
        duration: duration,
        durationFormatted: this.formatDuration(duration),
        successRate: this.stats.total > 0
          ? ((this.stats.completed / this.stats.total) * 100).toFixed(2) + '%'
          : '0%'
      },
      success: this.results.success,
      errors: this.results.errors
    };
  }

  // Stats en temps réel
  getCurrentStats() {
    return {
      ...this.stats,
      queueSize: this.queue.size,
      pendingJobs: this.queue.pending,
      activeJobs: Array.from(this.activeJobs.entries()).map(([jobId, info]) => ({
        jobId,
        platform: info.account.platform,
        username: info.account.username,
        attempts: info.attempts,
        duration: Date.now() - info.startTime
      }))
    };
  }

  // Vider la queue
  clear() {
    this.queue.clear();
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      running: 0,
      startTime: null,
      endTime: null
    };
    this.results = {
      success: [],
      errors: []
    };
    this.activeJobs.clear();
  }

  // Pause/Resume
  pause() {
    this.queue.pause();
    this.emit('queue:paused');
  }

  resume() {
    this.queue.start();
    this.emit('queue:resumed');
  }

  // Utilitaires
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

module.exports = QueueManager;
