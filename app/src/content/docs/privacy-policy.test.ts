import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Policy = {
  file: string;
  date: string;
  present: string[];
  absent: string[];
};

const POLICIES: Record<'en' | 'ja', Policy> = {
  en: {
    file: './privacy-policy.mdx',
    date: 'Last updated: October 28, 2026',
    present: [
      '| `cookie_consent` (local storage) | Remembers whether you accepted or declined analytics | Kept until you clear it |',
      '| `starlight-theme` (local storage) | Light/dark theme preference | Kept until you clear it |',
      '| `_ga`, `_ga_*` | Google Analytics tracking (only with consent) | 2 years |',
      'To change or withdraw consent, use "Cookie settings" at the bottom of any page. If you decline, existing Google Analytics cookies (such as `_ga`) are deleted.',
      'This data is collected using pseudonymous identifiers, not your name or contact details, and is used only to improve our content and user experience.',
      '- Google Analytics keeps event-level data for 2 months and user-level data for 14 months (the user-level period restarts when you visit again).',
      "When the comment section on an article loads, content is fetched from Giscus (giscus.app) and GitHub, which receive data such as your IP address and the page URL. If you sign in with GitHub, a session token is stored in your browser's local storage (`giscus-session`).",
      '- **Google Analytics** - Web analytics',
      '- **Giscus** - Comment system (via GitHub)',
      '- **GitHub Sponsors** - Sponsor button on the About page (loaded from github.com; GitHub may set its own cookies)',
      '- **Cloudflare** - Hosting and content delivery. Cloudflare processes request data such as IP addresses to deliver and secure the site.',
    ],
    absent: ['This data is anonymized', '1 year', "clearing your browser's cookies"],
  },
  ja: {
    file: './ja/privacy-policy.mdx',
    date: '最終更新日: 2026年10月28日',
    present: [
      '| `cookie_consent`（localStorage） | アナリティクスへの同意・拒否の選択を記憶 | 削除するまで保持 |',
      '| `starlight-theme`（localStorage） | ライト／ダークの表示設定 | 削除するまで保持 |',
      '| `_ga`, `_ga_*` | Google Analytics トラッキング（同意時のみ） | 2年 |',
      '同意を変更・撤回するには、ページ下部の「Cookie 設定」から選び直してください。拒否を選ぶと、保存済みの Google アナリティクスの Cookie（`_ga` など）も削除されます。',
      'これらのデータは個人を直接特定しない形（仮名化された識別子）で集計され、コンテンツとユーザー体験の改善のためにのみ使用されます。',
      '- Google アナリティクスのデータは、イベント単位で 2 か月、ユーザー単位で 14 か月保持されます（再訪問があるとユーザー単位の期間は延長されます）。',
      '記事ページのコメント欄を表示すると、Giscus（giscus.app）と GitHub からコンテンツが読み込まれ、IP アドレスや閲覧ページの URL などがこれらのサービスに送信されます。GitHub でサインインした場合、ログイン状態を保つためのトークンがブラウザの localStorage（`giscus-session`）に保存されます。',
      '- **Google Analytics** - ウェブアナリティクス',
      '- **Giscus** - コメントシステム（GitHub 経由）',
      '- **GitHub Sponsors** - About ページのスポンサーボタン（github.com から読み込まれ、GitHub が Cookie を設定する場合があります）',
      '- **Cloudflare** - ホスティングおよび配信。セキュリティと配信のため、IP アドレスやリクエスト情報が Cloudflare により処理されます。',
    ],
    absent: ['匿名化され', '1年', 'ブラウザの Cookie をクリア'],
  },
};

function read(file: string): { frontmatter: string; body: string } {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file} has no frontmatter`);
  return { frontmatter: match[1], body: match[2] };
}

describe.each(Object.entries(POLICIES))('%s privacy policy', (_locale, policy) => {
  const { frontmatter, body } = read(policy.file);

  it('shows the in-body date as the only date', () => {
    expect(frontmatter).toMatch(/^lastUpdated: false$/m);
    expect(frontmatter).not.toMatch(/^publishedAt:/m);
    expect(body.trimStart().split('\n')[0]).toBe(policy.date);
  });

  it.each(policy.present)('says %s', (sentence) => {
    expect(body).toContain(sentence);
  });

  it.each(policy.absent)('no longer says %s', (phrase) => {
    expect(body).not.toContain(phrase);
  });
});
