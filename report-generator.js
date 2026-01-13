const ExcelJS = require('exceljs');
const { db, accountQueries } = require('./database');
const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, 'reports');

    // Créer le dossier reports s'il n'existe pas
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir);
    }
  }

  // Générer un rapport quotidien complet
  async generateDailyReport(date = null) {
    const reportDate = date || new Date().toISOString().split('T')[0];
    const reportTime = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-').slice(0, 3).join('-');
    const filename = `rapport-${reportDate}-${reportTime}.xlsx`;
    const filepath = path.join(this.reportsDir, filename);

    console.log(`\n📊 Génération du rapport quotidien...`);
    console.log(`   Date: ${reportDate}`);
    console.log(`   Fichier: ${filename}\n`);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Social Media Tracker';
    workbook.created = new Date();

    // Feuille 1: Résumé général
    await this.createSummarySheet(workbook, reportDate);

    // Feuille 2: Détails par plateforme
    await this.createPlatformDetailsSheet(workbook, reportDate);

    // Feuille 3: Top performers
    await this.createTopPerformersSheet(workbook, reportDate);

    // Feuille 4: Comptes avec erreurs
    await this.createErrorSheet(workbook, reportDate);

    // Feuille 5: Historique 30 jours
    await this.createHistorySheet(workbook);

    // Sauvegarder
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ Rapport généré: ${filepath}\n`);

    return {
      filename,
      filepath,
      date: reportDate
    };
  }

  // Feuille 1: Résumé
  async createSummarySheet(workbook, date) {
    const sheet = workbook.addWorksheet('Résumé');

    // Styles
    const headerStyle = {
      font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // Titre
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = `RAPPORT QUOTIDIEN - ${date}`;
    sheet.getCell('A1').style = {
      font: { bold: true, size: 16 },
      alignment: { horizontal: 'center' }
    };
    sheet.getRow(1).height = 30;

    // Stats globales
    const globalStats = db.prepare(`
      SELECT
        COUNT(DISTINCT a.id) as total_accounts,
        COALESCE(SUM(d.total_videos), 0) as total_videos,
        COALESCE(SUM(d.total_views), 0) as total_views,
        COALESCE(SUM(d.new_videos), 0) as new_videos_today,
        COALESCE(SUM(d.new_views), 0) as new_views_today
      FROM accounts a
      LEFT JOIN daily_stats d ON a.id = d.account_id AND d.date = ?
    `).get(date);

    sheet.addRow([]);
    sheet.addRow(['Métrique', 'Valeur']);
    sheet.getRow(3).eachCell(cell => cell.style = headerStyle);

    sheet.addRow(['Comptes suivis', globalStats.total_accounts]);
    sheet.addRow(['Vidéos totales', globalStats.total_videos]);
    sheet.addRow(['Vues totales', globalStats.total_views]);
    sheet.addRow(['Nouvelles vidéos (aujourd\'hui)', globalStats.new_videos_today]);
    sheet.addRow(['Nouvelles vues (aujourd\'hui)', globalStats.new_views_today]);

    // Par plateforme
    sheet.addRow([]);
    sheet.addRow(['Plateforme', 'Comptes', 'Vidéos', 'Vues', 'Nouvelles vues']);
    sheet.getRow(10).eachCell(cell => cell.style = headerStyle);

    const platformStats = db.prepare(`
      SELECT
        a.platform,
        COUNT(DISTINCT a.id) as account_count,
        COALESCE(SUM(d.total_videos), 0) as total_videos,
        COALESCE(SUM(d.total_views), 0) as total_views,
        COALESCE(SUM(d.new_views), 0) as new_views_today
      FROM accounts a
      LEFT JOIN daily_stats d ON a.id = d.account_id AND d.date = ?
      GROUP BY a.platform
    `).all(date);

    platformStats.forEach(stat => {
      sheet.addRow([
        stat.platform,
        stat.account_count,
        stat.total_videos,
        stat.total_views,
        stat.new_views_today
      ]);
    });

    // Auto-size colonnes
    sheet.columns.forEach(column => {
      column.width = 25;
    });
  }

  // Feuille 2: Détails par plateforme
  async createPlatformDetailsSheet(workbook, date) {
    const sheet = workbook.addWorksheet('Détails par compte');

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    };

    // En-têtes
    sheet.addRow([
      'Plateforme',
      'Username',
      'URL',
      'Vidéos totales',
      'Vues totales',
      'Nouvelles vidéos',
      'Nouvelles vues',
      'Scrapé le'
    ]);
    sheet.getRow(1).eachCell(cell => cell.style = headerStyle);

    // Données
    const accounts = db.prepare(`
      SELECT
        a.platform,
        a.username,
        a.url,
        COALESCE(d.total_videos, 0) as total_videos,
        COALESCE(d.total_views, 0) as total_views,
        COALESCE(d.new_videos, 0) as new_videos,
        COALESCE(d.new_views, 0) as new_views,
        d.scraped_at
      FROM accounts a
      LEFT JOIN daily_stats d ON a.id = d.account_id AND d.date = ?
      ORDER BY a.platform, a.username
    `).all(date);

    accounts.forEach(account => {
      sheet.addRow([
        account.platform,
        account.username,
        account.url,
        account.total_videos,
        account.total_views,
        account.new_videos,
        account.new_views,
        account.scraped_at || 'Non scrapé'
      ]);
    });

    sheet.columns.forEach(column => {
      column.width = 20;
    });
    sheet.getColumn(3).width = 40; // URL plus large
  }

  // Feuille 3: Top performers
  async createTopPerformersSheet(workbook, date) {
    const sheet = workbook.addWorksheet('Top Performers');

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }
    };

    // Top 10 nouvelles vues
    sheet.addRow(['TOP 10 - NOUVELLES VUES AUJOURD\'HUI']);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow([]);

    sheet.addRow(['Rang', 'Plateforme', 'Username', 'Nouvelles vues']);
    sheet.getRow(3).eachCell(cell => cell.style = headerStyle);

    const topViews = db.prepare(`
      SELECT
        a.platform,
        a.username,
        d.new_views
      FROM accounts a
      JOIN daily_stats d ON a.id = d.account_id
      WHERE d.date = ? AND d.new_views > 0
      ORDER BY d.new_views DESC
      LIMIT 10
    `).all(date);

    topViews.forEach((account, index) => {
      sheet.addRow([
        index + 1,
        account.platform,
        account.username,
        account.new_views
      ]);
    });

    // Top 10 nouvelles vidéos
    sheet.addRow([]);
    sheet.addRow(['TOP 10 - NOUVELLES VIDÉOS AUJOURD\'HUI']);
    sheet.getRow(sheet.lastRow.number).font = { bold: true, size: 14 };
    sheet.addRow([]);

    const startRow = sheet.lastRow.number + 1;
    sheet.addRow(['Rang', 'Plateforme', 'Username', 'Nouvelles vidéos']);
    sheet.getRow(startRow).eachCell(cell => cell.style = headerStyle);

    const topVideos = db.prepare(`
      SELECT
        a.platform,
        a.username,
        d.new_videos
      FROM accounts a
      JOIN daily_stats d ON a.id = d.account_id
      WHERE d.date = ? AND d.new_videos > 0
      ORDER BY d.new_videos DESC
      LIMIT 10
    `).all(date);

    topVideos.forEach((account, index) => {
      sheet.addRow([
        index + 1,
        account.platform,
        account.username,
        account.new_videos
      ]);
    });

    sheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  // Feuille 4: Erreurs
  async createErrorSheet(workbook, date) {
    const sheet = workbook.addWorksheet('Comptes non scrapés');

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }
    };

    sheet.addRow(['Plateforme', 'Username', 'URL', 'Statut']);
    sheet.getRow(1).eachCell(cell => cell.style = headerStyle);

    const notScraped = db.prepare(`
      SELECT
        a.platform,
        a.username,
        a.url
      FROM accounts a
      LEFT JOIN daily_stats d ON a.id = d.account_id AND d.date = ?
      WHERE d.id IS NULL
      ORDER BY a.platform, a.username
    `).all(date);

    notScraped.forEach(account => {
      sheet.addRow([
        account.platform,
        account.username,
        account.url,
        'Non scrapé'
      ]);
    });

    if (notScraped.length === 0) {
      sheet.addRow(['Aucun compte non scrapé', '', '', '✅ Tous les comptes ont été scrapés']);
    }

    sheet.columns.forEach(column => {
      column.width = 25;
    });
    sheet.getColumn(3).width = 40;
  }

  // Feuille 5: Historique 30 jours
  async createHistorySheet(workbook) {
    const sheet = workbook.addWorksheet('Historique 30 jours');

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    };

    sheet.addRow(['Date', 'Comptes scrapés', 'Nouvelles vidéos', 'Nouvelles vues']);
    sheet.getRow(1).eachCell(cell => cell.style = headerStyle);

    const history = db.prepare(`
      SELECT
        date,
        COUNT(DISTINCT account_id) as accounts,
        SUM(new_videos) as new_videos,
        SUM(new_views) as new_views
      FROM daily_stats
      WHERE date >= date('now', '-30 days')
      GROUP BY date
      ORDER BY date DESC
    `).all();

    history.forEach(day => {
      sheet.addRow([
        day.date,
        day.accounts,
        day.new_videos,
        day.new_views
      ]);
    });

    sheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  // Liste tous les rapports générés
  listReports() {
    const files = fs.readdirSync(this.reportsDir)
      .filter(file => file.endsWith('.xlsx'))
      .map(file => ({
        name: file,
        path: path.join(this.reportsDir, file),
        date: fs.statSync(path.join(this.reportsDir, file)).mtime
      }))
      .sort((a, b) => b.date - a.date);

    return files;
  }
}

// Si le script est exécuté directement
if (require.main === module) {
  const generator = new ReportGenerator();

  generator.generateDailyReport()
    .then((report) => {
      console.log('✓ Rapport généré avec succès:', report.filepath);
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Erreur lors de la génération:', error);
      process.exit(1);
    });
}

module.exports = ReportGenerator;
