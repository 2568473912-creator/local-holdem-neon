import type { AppLanguage } from '../../i18n';

export type LegalTab = 'privacy' | 'storage';

interface LegalOverlayProps {
  language: AppLanguage;
  open: boolean;
  tab: LegalTab;
  onClose: () => void;
  onChangeTab: (tab: LegalTab) => void;
}

const legalCopy: Record<
  AppLanguage,
  {
    sheetTitle: string;
    sheetSubtitle: string;
    close: string;
    tabs: Record<LegalTab, string>;
    content: Record<LegalTab, { title: string; subtitle: string; bullets: string[] }>;
  }
> = {
  'zh-CN': {
    sheetTitle: '应用信息',
    sheetSubtitle: '本地版说明',
    close: '关闭',
    tabs: {
      privacy: '隐私说明',
      storage: '离线与存档',
    },
    content: {
      privacy: {
        title: '隐私说明',
        subtitle: '离线游玩，无账号，无上传。',
        bullets: ['不需要注册账号。', '对局、设置和回放不上传到远程服务器。', '当前版本未接入广告、统计、推送或第三方登录。'],
      },
      storage: {
        title: '离线与存档',
        subtitle: '设置、回放和战绩仅保存在本机。',
        bullets: ['本地历史、回放和生涯战绩会写入设备存储。', '主屏模式会缓存必要资源，方便离线启动。', '清空站点数据或卸载应用后，本地存档会被移除。'],
      },
    },
  },
  en: {
    sheetTitle: 'App Info',
    sheetSubtitle: 'Local build notes',
    close: 'Close',
    tabs: {
      privacy: 'Privacy',
      storage: 'Offline & Saves',
    },
    content: {
      privacy: {
        title: 'Privacy',
        subtitle: 'Offline play, no account, no uploads.',
        bullets: ['No account is required.', 'Hands, settings, and replays are not uploaded to any remote server.', 'This build has no ads, analytics, push notifications, or third-party sign-in.'],
      },
      storage: {
        title: 'Offline & Saves',
        subtitle: 'Settings, replays, and career data stay on this device.',
        bullets: ['Local history, replays, and career records are stored on the device.', 'Standalone mode caches essential assets for offline launch.', 'Clearing site data or uninstalling the app removes local saves.'],
      },
    },
  },
  ja: {
    sheetTitle: 'アプリ情報',
    sheetSubtitle: 'ローカル版ガイド',
    close: '閉じる',
    tabs: {
      privacy: 'プライバシー',
      storage: 'オフライン保存',
    },
    content: {
      privacy: {
        title: 'プライバシー',
        subtitle: 'オフライン専用、アカウント不要、アップロードなし。',
        bullets: ['アカウント登録は不要です。', 'ハンド履歴、設定、リプレイは外部サーバーへ送信されません。', '広告、解析、プッシュ通知、外部ログインは未導入です。'],
      },
      storage: {
        title: 'オフライン保存',
        subtitle: '設定、リプレイ、戦績はこの端末だけに保存されます。',
        bullets: ['ローカル履歴、リプレイ、キャリア戦績は端末ストレージに保存されます。', 'ホーム画面版では必要な資産をキャッシュし、オフライン起動に対応します。', 'サイトデータの削除やアプリ削除でローカル保存は消去されます。'],
      },
    },
  },
  fr: {
    sheetTitle: 'Infos app',
    sheetSubtitle: 'Notes de la version locale',
    close: 'Fermer',
    tabs: {
      privacy: 'Confidentialité',
      storage: 'Hors ligne & sauvegardes',
    },
    content: {
      privacy: {
        title: 'Confidentialité',
        subtitle: 'Jeu hors ligne, sans compte, sans envoi.',
        bullets: ['Aucun compte n’est nécessaire.', 'Les parties, réglages et replays ne sont envoyés vers aucun serveur distant.', 'Cette version n’intègre ni publicité, ni analytics, ni notifications push, ni connexion tierce.'],
      },
      storage: {
        title: 'Hors ligne & sauvegardes',
        subtitle: 'Réglages, replays et carrière restent sur cet appareil.',
        bullets: ['L’historique local, les replays et la carrière sont stockés sur l’appareil.', 'Le mode écran d’accueil met en cache les ressources utiles pour un lancement hors ligne.', 'Effacer les données du site ou désinstaller l’app supprime les sauvegardes locales.'],
      },
    },
  },
  de: {
    sheetTitle: 'App-Infos',
    sheetSubtitle: 'Hinweise zur lokalen Version',
    close: 'Schließen',
    tabs: {
      privacy: 'Datenschutz',
      storage: 'Offline & Speicherstände',
    },
    content: {
      privacy: {
        title: 'Datenschutz',
        subtitle: 'Offline-Spiel, kein Konto, keine Uploads.',
        bullets: ['Es ist kein Konto erforderlich.', 'Hände, Einstellungen und Replays werden an keinen Server übertragen.', 'Diese Version nutzt keine Werbung, kein Tracking, keine Push-Nachrichten und kein Drittanbieter-Login.'],
      },
      storage: {
        title: 'Offline & Speicherstände',
        subtitle: 'Einstellungen, Replays und Karriere bleiben auf diesem Gerät.',
        bullets: ['Lokale Historie, Replays und Karrierewerte werden auf dem Gerät gespeichert.', 'Der Startbildschirm-Modus cached nötige Assets für den Offline-Start.', 'Beim Löschen der Websitedaten oder der App werden lokale Speicherstände entfernt.'],
      },
    },
  },
};

export function LegalOverlay({ language, open, tab, onClose, onChangeTab }: LegalOverlayProps) {
  if (!open) {
    return null;
  }

  const copy = legalCopy[language];
  const tabContent = copy.content[tab];

  return (
    <div className="legal-overlay" role="presentation" onClick={onClose}>
      <section className="legal-sheet glass-panel" role="dialog" aria-modal="true" aria-label={copy.sheetTitle} onClick={(event) => event.stopPropagation()}>
        <header className="legal-sheet-head">
          <div>
            <strong>{copy.sheetTitle}</strong>
            <span>{copy.sheetSubtitle}</span>
          </div>
          <button className="btn mini" type="button" onClick={onClose}>
            {copy.close}
          </button>
        </header>

        <div className="legal-tabs" role="tablist" aria-label={copy.sheetTitle}>
          <button className={`btn mini ${tab === 'privacy' ? 'primary' : ''}`} type="button" onClick={() => onChangeTab('privacy')}>
            {copy.tabs.privacy}
          </button>
          <button className={`btn mini ${tab === 'storage' ? 'primary' : ''}`} type="button" onClick={() => onChangeTab('storage')}>
            {copy.tabs.storage}
          </button>
        </div>

        <article className="legal-body">
          <strong>{tabContent.title}</strong>
          <p>{tabContent.subtitle}</p>
          <ul>
            {tabContent.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
