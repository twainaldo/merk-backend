// Notification system
const showNotification = (message, type = 'info') => {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
};

// Format numbers
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Load dashboard data
const loadDashboard = async () => {
  try {
    const response = await fetch('/api/dashboard');
    const data = await response.json();

    // Update global stats
    let totalAccounts = 0;
    let totalVideos = 0;
    let totalViews = 0;
    let newViewsToday = 0;

    data.summary.forEach(platform => {
      totalAccounts += platform.account_count;
      totalVideos += platform.total_videos || 0;
      totalViews += platform.total_views || 0;
      newViewsToday += platform.new_views_today || 0;
    });

    document.getElementById('totalAccounts').textContent = totalAccounts;
    document.getElementById('totalVideos').textContent = formatNumber(totalVideos);
    document.getElementById('totalViews').textContent = formatNumber(totalViews);
    document.getElementById('newViewsToday').textContent = formatNumber(newViewsToday);

    // Platform summary
    const platformSummary = document.getElementById('platformSummary');
    platformSummary.innerHTML = '';

    data.summary.forEach(platform => {
      const card = document.createElement('div');
      card.className = `platform-card ${platform.platform.toLowerCase()}`;
      card.innerHTML = `
        <div class="platform-name">${platform.platform}</div>
        <div class="platform-stats">
          <div>${platform.account_count} compte(s)</div>
          <div>${formatNumber(platform.total_videos || 0)} vidéos</div>
          <div>${formatNumber(platform.total_views || 0)} vues totales</div>
          <div style="color: #4caf50; font-weight: bold;">
            +${formatNumber(platform.new_views_today || 0)} vues aujourd'hui
          </div>
        </div>
      `;
      platformSummary.appendChild(card);
    });

    // Recent activity
    const recentActivity = document.getElementById('recentActivity');
    recentActivity.innerHTML = '';

    if (data.recentActivity.length === 0) {
      recentActivity.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-text">Aucune activité récente</div>
        </div>
      `;
    } else {
      data.recentActivity.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
          <div class="activity-info">
            <div class="activity-platform">${activity.platform}</div>
            <div class="activity-username">@${activity.username}</div>
            <div class="activity-date">${activity.date}</div>
          </div>
          <div class="activity-stats">
            <div class="activity-stat">${formatNumber(activity.total_videos)} vidéos</div>
            <div class="activity-stat">${formatNumber(activity.total_views)} vues</div>
            ${activity.new_views > 0 ? `
              <div class="activity-stat highlight">+${formatNumber(activity.new_views)} vues</div>
            ` : ''}
          </div>
        `;
        recentActivity.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showNotification('Erreur lors du chargement du dashboard', 'error');
  }
};

// Load accounts
const loadAccounts = async () => {
  try {
    const response = await fetch('/api/accounts');
    const accounts = await response.json();

    const accountsList = document.getElementById('accountsList');
    accountsList.innerHTML = '';

    if (accounts.length === 0) {
      accountsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📱</div>
          <div class="empty-state-text">Aucun compte ajouté. Cliquez sur "Ajouter un compte" pour commencer.</div>
        </div>
      `;
      return;
    }

    // Load stats for each account
    for (const account of accounts) {
      const statsResponse = await fetch(`/api/stats/${account.id}`);
      const stats = await statsResponse.json();
      const latestStats = stats[0] || null;

      const card = document.createElement('div');
      card.className = `account-card ${account.platform.toLowerCase()}`;
      card.innerHTML = `
        <div class="account-header">
          <div class="account-info">
            <div class="account-platform">${account.platform}</div>
            <div class="account-username">@${account.username}</div>
            <a href="${account.url}" target="_blank" class="account-url">${account.url}</a>
          </div>
        </div>
        ${latestStats ? `
          <div class="account-stats">
            <div class="stat-item">
              <div class="stat-item-value">${formatNumber(latestStats.total_videos)}</div>
              <div class="stat-item-label">Vidéos</div>
            </div>
            <div class="stat-item">
              <div class="stat-item-value">${formatNumber(latestStats.total_views)}</div>
              <div class="stat-item-label">Vues totales</div>
            </div>
            ${latestStats.new_videos > 0 ? `
              <div class="stat-item new">
                <div class="stat-item-value">+${latestStats.new_videos}</div>
                <div class="stat-item-label">Nouvelles vidéos</div>
              </div>
            ` : ''}
            ${latestStats.new_views > 0 ? `
              <div class="stat-item new">
                <div class="stat-item-value">+${formatNumber(latestStats.new_views)}</div>
                <div class="stat-item-label">Nouvelles vues</div>
              </div>
            ` : ''}
          </div>
        ` : `
          <div style="text-align: center; padding: 20px; color: #999;">
            Pas encore de données
          </div>
        `}
        <button class="btn btn-danger delete-btn" onclick="deleteAccount(${account.id})">🗑️</button>
      `;
      accountsList.appendChild(card);
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
    showNotification('Erreur lors du chargement des comptes', 'error');
  }
};

// Add account
document.getElementById('accountForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const platform = document.getElementById('platform').value;
  const username = document.getElementById('username').value;
  const url = document.getElementById('url').value;

  try {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ platform, username, url })
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Compte ajouté avec succès', 'success');
      document.getElementById('accountForm').reset();
      document.getElementById('addAccountForm').style.display = 'none';
      loadAccounts();
      loadDashboard();
    } else {
      showNotification(data.error || 'Erreur lors de l\'ajout du compte', 'error');
    }
  } catch (error) {
    console.error('Error adding account:', error);
    showNotification('Erreur lors de l\'ajout du compte', 'error');
  }
});

// Delete account
const deleteAccount = async (id) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte ?')) {
    return;
  }

  try {
    const response = await fetch(`/api/accounts/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Compte supprimé avec succès', 'success');
      loadAccounts();
      loadDashboard();
    } else {
      showNotification(data.error || 'Erreur lors de la suppression', 'error');
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    showNotification('Erreur lors de la suppression', 'error');
  }
};

// Scrape now
document.getElementById('scrapeNowBtn').addEventListener('click', async () => {
  const btn = document.getElementById('scrapeNowBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<div class="loading"></div> Scraping en cours...';
  btn.disabled = true;

  try {
    const response = await fetch('/api/scrape', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      showNotification('Scraping lancé ! Les résultats seront disponibles dans quelques minutes.', 'success');

      // Reload data after 30 seconds
      setTimeout(() => {
        loadAccounts();
        loadDashboard();
      }, 30000);
    } else {
      showNotification(data.error || 'Erreur lors du scraping', 'error');
    }
  } catch (error) {
    console.error('Error scraping:', error);
    showNotification('Erreur lors du scraping', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

// Toggle add account form
document.getElementById('addAccountBtn').addEventListener('click', () => {
  const addForm = document.getElementById('addAccountForm');
  const bulkForm = document.getElementById('bulkAddForm');

  // Fermer le bulk form si ouvert
  bulkForm.style.display = 'none';

  // Toggle add form
  addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  document.getElementById('addAccountForm').style.display = 'none';
  document.getElementById('accountForm').reset();
});

// Toggle bulk add form
document.getElementById('bulkAddBtn').addEventListener('click', () => {
  const addForm = document.getElementById('addAccountForm');
  const bulkForm = document.getElementById('bulkAddForm');

  // Fermer le add form si ouvert
  addForm.style.display = 'none';

  // Toggle bulk form
  bulkForm.style.display = bulkForm.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('cancelBulkBtn').addEventListener('click', () => {
  document.getElementById('bulkAddForm').style.display = 'none';
  document.getElementById('bulkForm').reset();
});

// Bulk add accounts
document.getElementById('bulkForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = document.getElementById('bulkText').value;
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;

  btn.innerHTML = '<div class="loading"></div> Importation...';
  btn.disabled = true;

  try {
    const response = await fetch('/api/accounts/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (data.success) {
      showNotification(`${data.imported} compte(s) ajouté(s) avec succès !`, 'success');

      // Afficher les erreurs s'il y en a
      if (data.skipped > 0) {
        setTimeout(() => {
          showNotification(`${data.skipped} compte(s) ignoré(s) - Vérifiez les URLs`, 'info');
        }, 2000);
      }

      document.getElementById('bulkForm').reset();
      document.getElementById('bulkAddForm').style.display = 'none';

      loadAccounts();
      loadDashboard();
    } else {
      showNotification(data.error || 'Erreur lors de l\'import', 'error');
    }
  } catch (error) {
    console.error('Error bulk adding accounts:', error);
    showNotification('Erreur lors de l\'import', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadAccounts();

  // Auto-refresh every 5 minutes
  setInterval(() => {
    loadDashboard();
    loadAccounts();
  }, 300000);
});
