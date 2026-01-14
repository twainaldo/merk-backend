const { createClient } = require('@supabase/supabase-js');

// Initialiser le client Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Utiliser la service_role key pour le backend

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans les variables d\'environnement');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log(`📊 Supabase client initialized: ${supabaseUrl}`);

// Queries pour les comptes
const accountQueries = {
  // Récupérer tous les comptes
  getAll: {
    all: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  },

  // Récupérer par platform
  getByPlatform: {
    all: async (platform) => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('platform', platform)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  },

  // Récupérer par ID
  getById: {
    get: async (id) => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data || null;
    }
  },

  // Ajouter un compte
  add: {
    run: async (params) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          platform: params.platform,
          username: params.username,
          url: params.url
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    }
  },

  // Supprimer un compte
  delete: {
    run: async (id) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { changes: 1 };
    }
  }
};

// Queries pour les vidéos
const videoQueries = {
  // Récupérer toutes les URLs de vidéos pour un compte
  getUrlsByAccount: {
    all: async (accountId) => {
      const { data, error } = await supabase
        .from('videos')
        .select('video_url')
        .eq('account_id', accountId);

      if (error) throw error;
      return data || [];
    }
  },

  // Insérer ou mettre à jour une vidéo avec toutes les données
  upsertFull: {
    run: async (params) => {
      const { data, error } = await supabase
        .from('videos')
        .upsert({
          account_id: params.account_id,
          video_url: params.video_url,
          video_id: params.video_id,
          views: params.views,
          likes: params.likes,
          comments: params.comments,
          shares: params.shares,
          saves: params.saves,
          duration: params.duration,
          published_date: params.published_date,
          description: params.description,
          hashtags: params.hashtags,
          audio_name: params.audio_name,
          audio_url: params.audio_url,
          thumbnail_url: params.thumbnail_url,
          last_scraped_at: new Date().toISOString()
        }, {
          onConflict: 'video_url'
        });

      if (error) throw error;
      return data;
    }
  },

  // Mettre à jour seulement les métriques d'une vidéo
  updateMetrics: {
    run: async (params) => {
      const { data, error } = await supabase
        .from('videos')
        .update({
          views: params.views,
          likes: params.likes,
          comments: params.comments,
          shares: params.shares,
          saves: params.saves,
          last_scraped_at: new Date().toISOString()
        })
        .eq('video_url', params.video_url);

      if (error) throw error;
      return data;
    }
  },

  // Récupérer toutes les vidéos d'un compte
  getByAccount: {
    all: async (accountId) => {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('account_id', accountId)
        .order('published_date', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  },

  // Calculer les totaux pour un compte
  getTotals: {
    get: async (accountId) => {
      const { data, error } = await supabase
        .from('videos')
        .select('views, likes')
        .eq('account_id', accountId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { total_videos: 0, total_views: 0 };
      }

      const total_videos = data.length;
      const total_views = data.reduce((sum, v) => sum + (v.views || 0), 0);

      return { total_videos, total_views };
    }
  }
};

// Queries pour les stats horaires
const hourlyQueries = {
  // Ajouter une stat horaire
  add: {
    run: async (params) => {
      const { data, error } = await supabase
        .from('hourly_stats')
        .insert({
          account_id: params.account_id,
          total_videos: params.total_videos,
          total_views: params.total_views,
          delta_videos: params.delta_videos,
          delta_views: params.delta_views,
          followers: params.followers,
          likes: params.likes,
          platform: params.platform,
          username: params.username
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Récupérer la dernière stat pour un compte
  getLatest: {
    get: async (accountId) => {
      const { data, error } = await supabase
        .from('hourly_stats')
        .select('*')
        .eq('account_id', accountId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data || null;
    }
  },

  // Récupérer toutes les stats
  getAll: {
    all: async () => {
      const { data, error } = await supabase
        .from('hourly_stats')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  },

  // Récupérer les stats d'un compte sur une période
  getByAccountAndHours: {
    all: async (accountId, hours) => {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('hourly_stats')
        .select('*')
        .eq('account_id', accountId)
        .gte('timestamp', hoursAgo)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  },

  // Récupérer les dernières stats pour chaque compte
  getLatestPerAccount: {
    all: async () => {
      // Supabase ne supporte pas DISTINCT ON directement, donc on fait une requête RPC
      // Pour l'instant, on récupère toutes les stats et on filtre côté JS
      const { data, error } = await supabase
        .from('hourly_stats')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Filtrer pour garder seulement la dernière stat par account_id
      const latestPerAccount = {};
      (data || []).forEach(stat => {
        if (!latestPerAccount[stat.account_id]) {
          latestPerAccount[stat.account_id] = stat;
        }
      });

      return Object.values(latestPerAccount);
    }
  }
};

module.exports = {
  supabase,
  accountQueries,
  videoQueries,
  hourlyQueries
};
