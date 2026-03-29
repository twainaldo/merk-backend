require('dotenv').config();
const { spawn } = require('child_process');

console.log('🚀 Starting Merk Analytics in Production Mode...\n');

// Lancer le serveur API
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

// Attendre 3 secondes pour que le serveur démarre
setTimeout(() => {
  console.log('\n🤖 Starting detailed scraping worker...\n');

  // Lancer le worker détaillé
  const worker = spawn('node', ['detailed-worker.js'], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  worker.on('error', (error) => {
    console.error('❌ Worker error:', error);
  });

  worker.on('exit', (code) => {
    console.log(`⚠️ Worker exited with code ${code}, restarting...`);
    // Redémarrer le worker s'il crash
    setTimeout(() => {
      spawn('node', ['detailed-worker.js'], {
        stdio: 'inherit',
        env: { ...process.env }
      });
    }, 5000);
  });
}, 3000);

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  server.kill('SIGINT');
  process.exit(0);
});
