const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const path = require('path');

class ProxyManager {
  constructor() {
    
    this.proxies = [];
    this.currentIndex = 0;
    this.failedProxies = new Set();
    this.lastFetch = null;
    this.fetchInterval = 30 * 60 * 1000; // Rafraîchir toutes les 30 minutes
    this.goodProxiesFile = path.join(__dirname, 'good-proxies.json');

    // Ordre de priorité pour charger les proxies:
    // 1. Fichier proxies (proxies privés/payants)
    // 2. good-proxies.json (proxies testés et validés)
    if (!this.loadFromFile('proxies')) {
      this.loadGoodProxies();
    }
  }

  // Charger les proxies depuis le fichier proxies.txt
  loadFromFile(filePath = 'proxies') {
    const fullPath = path.join(__dirname, filePath);

    if (fs.existsSync(fullPath)) {
      try {
        const data = fs.readFileSync(fullPath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim());

        const proxies = lines.map(line => {
          const [host, port] = line.trim().split(':');
          return {
            protocol: 'http',
            host,
            port: parseInt(port),
            username: null,
            password: null
          };
        }).filter(p => p.host && p.port);

        if (proxies.length > 0) {
          this.proxies = proxies;
          console.log(`✅ ${proxies.length} proxies chargés depuis ${filePath} !`);
          return true;
        }
      } catch (error) {
        console.log(`⚠️ Erreur lecture ${filePath}:`, error.message);
      }
    }
    return false;
  }

  // Charger les bons proxies testés
  loadGoodProxies() {
    if (fs.existsSync(this.goodProxiesFile)) {
      try {
        const data = fs.readFileSync(this.goodProxiesFile, 'utf8');
        const goodProxies = JSON.parse(data);

        if (goodProxies.length > 0) {
          this.proxies = goodProxies;
          console.log(`✅ ${goodProxies.length} bons proxies pré-testés chargés !`);
          return true;
        }
      } catch (error) {
        console.log('⚠️ Erreur lecture bons proxies:', error.message);
      }
    }
    return false;
  }

  // Sources de proxies gratuits
  async fetchFreeProxies() {
    // Ordre de priorité:
    // 1. Fichier proxies (privés/payants)
    // 2. good-proxies.json (testés et validés)
    // 3. Proxies gratuits en ligne

    if (this.loadFromFile('proxies')) {
      this.lastFetch = Date.now();
      return this.proxies.length;
    }

    if (this.loadGoodProxies()) {
      this.lastFetch = Date.now();
      return this.proxies.length;
    }

    console.log('📡 Récupération de proxies gratuits...');

    const sources = [
      // ProxyScrape
      'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',

      // Geonode
      'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',

      // GitHub proxy lists (public)
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    ];

    const newProxies = [];

    for (const source of sources) {
      try {
        const response = await axios.get(source, { timeout: 10000 });

        if (source.includes('geonode')) {
          // Format JSON de Geonode
          const data = response.data;
          if (data.data) {
            data.data.forEach(proxy => {
              if (proxy.ip && proxy.port) {
                newProxies.push({
                  host: proxy.ip,
                  port: proxy.port,
                  protocol: proxy.protocols[0] || 'http',
                  country: proxy.country || 'unknown'
                });
              }
            });
          }
        } else {
          // Format texte (IP:PORT par ligne)
          const lines = response.data.split('\n');
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes(':')) {
              const [host, port] = trimmed.split(':');
              if (host && port) {
                newProxies.push({
                  host: host.trim(),
                  port: parseInt(port.trim()),
                  protocol: 'http',
                  country: 'unknown'
                });
              }
            }
          });
        }
      } catch (error) {
        console.log(`❌ Erreur source ${source.substring(0, 50)}...`);
      }
    }

    // Dédupliquer
    const uniqueProxies = Array.from(
      new Map(newProxies.map(p => [`${p.host}:${p.port}`, p])).values()
    );

    this.proxies = uniqueProxies;
    this.lastFetch = Date.now();

    console.log(`✅ ${this.proxies.length} proxies chargés`);
    return this.proxies.length;
  }

  // Obtenir le prochain proxy (rotation)
  getNextProxy() {
    if (this.proxies.length === 0) {
      return null;
    }

    // Rafraîchir si nécessaire
    if (!this.lastFetch || Date.now() - this.lastFetch > this.fetchInterval) {
      this.fetchFreeProxies().catch(console.error);
    }

    // Trouver un proxy qui n'a pas échoué
    let attempts = 0;
    while (attempts < this.proxies.length) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      const proxyKey = `${proxy.host}:${proxy.port}`;
      if (!this.failedProxies.has(proxyKey)) {
        return proxy;
      }

      attempts++;
    }

    // Tous les proxies ont échoué, réinitialiser
    console.log('⚠️ Tous les proxies ont échoué, réinitialisation...');
    this.failedProxies.clear();
    return this.proxies[0] || null;
  }

  // Marquer un proxy comme défaillant
  markProxyAsFailed(proxy) {
    if (proxy) {
      const proxyKey = `${proxy.host}:${proxy.port}`;
      this.failedProxies.add(proxyKey);
      console.log(`❌ Proxy marqué comme défaillant: ${proxyKey}`);
    }
  }

  // Obtenir l'URL du proxy pour Puppeteer
  getProxyUrl(proxy) {
    if (!proxy) return null;
    return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
  }

  // Test de proxy (optionnel)
  async testProxy(proxy, timeout = 5000) {
    try {
      const proxyUrl = this.getProxyUrl(proxy);
      const agent = new SocksProxyAgent(proxyUrl);

      const response = await axios.get('https://api.ipify.org?format=json', {
        timeout,
        httpAgent: agent,
        httpsAgent: agent
      });

      return response.data.ip ? true : false;
    } catch (error) {
      return false;
    }
  }

  // Stats
  getStats() {
    return {
      total: this.proxies.length,
      failed: this.failedProxies.size,
      active: this.proxies.length - this.failedProxies.size,
      lastFetch: this.lastFetch ? new Date(this.lastFetch).toISOString() : null
    };
  }
}

// Instance singleton
const proxyManager = new ProxyManager();

module.exports = proxyManager;
