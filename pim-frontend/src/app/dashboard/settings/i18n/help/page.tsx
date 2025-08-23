import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function I18nHelpPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const { data: { user } } = await supabase.auth.getUser();
  const bypassEnv = process.env.E2E_BYPASS_AUTH === '1';
  const bypassQuery = process.env.NODE_ENV !== 'production' && ((sp.e2e||'')==='1' || (sp.bypass||'')==='1');
  const bypass = bypassEnv || bypassQuery;
  if (!user && !bypass) redirect('/login');

  return (
    <article className="help-doc prose max-w-none prose-sm">
      <header>
        <h1 id="toc">I18n Settings — Посібник користувача</h1>
        <blockquote>
          <p>Цей довідник допоможе крок‑за‑кроком налаштувати переклади інтерфейсу: мови, імпорт/експорт, ключі/повідомлення, орг‑перекриття, звіти та аудит.</p>
        </blockquote>
      </header>

      <nav aria-label="Зміст">
        <h2>Зміст</h2>
        <ol>
          <li><a href="#overview">Огляд і ролі доступу</a></li>
          <li><a href="#quickstart">Швидкий старт</a></li>
          <li><a href="#languages">Languages</a></li>
          <li><a href="#import-export">Import/Export</a></li>
          <li><a href="#keys">Keys (admin)</a></li>
          <li><a href="#messages">Messages (admin)</a></li>
          <li><a href="#overrides">Overrides (org)</a></li>
          <li><a href="#missing">Missing</a></li>
          <li><a href="#audit">Audit</a></li>
          <li><a href="#performance">Перформанс і кеш</a></li>
          <li><a href="#errors">Часті помилки і рішення</a></li>
          <li><a href="#faq">FAQ і глосарій</a></li>
          <li><a href="#compliance">ICP — запуск і автоматизація</a></li>
        </ol>
      </nav>

      <section id="overview">
        <h2>1) Огляд і ролі доступу</h2>
        <p>Доступ визначає, що саме ви можете робити у розділі.</p>
        <dl>
          <dt><strong>Platform admin</strong></dt>
          <dd>Повний глобальний доступ: створення <code>keys/messages</code>, глобальний <code>Import/Export</code>, перегляд/зміна усіх даних.</dd>
          <dt><strong>Учасник організації</strong></dt>
          <dd>Дії в межах своєї орг: <code>UI Languages</code>, <code>Overrides</code>, експорт лише орг‑перекриттів, імпорт у <code>scope=org</code>.</dd>
        </dl>
      </section>

      <section id="quickstart">
        <h2>2) Швидкий старт</h2>
        <ol>
          <li>У вкладці <strong>Languages</strong> оберіть власну мову інтерфейсу. Адміністратор за потреби додає UI‑мови орг.</li>
          <li>У <strong>Import/Export → Export</strong> завантажте JSON/CSV (не‑адмін отримує лише <em>org overrides</em>).</li>
          <li>У <strong>Import/Export → Import</strong> завантажте файл → <mark>Preflight</mark> → виправте попередження → <strong>Start Job</strong> → слідкуйте за статусом/логами.</li>
          <li>(Адмін) У <strong>Keys/Messages</strong> додайте ключі та відредагуйте глобальні повідомлення (з ICU‑перевіркою).</li>
          <li>(Учасник орг) У <strong>Overrides</strong> додайте перекриття спеціально для вашої організації.</li>
        </ol>
      </section>

      <section id="languages">
        <h2>3) Languages</h2>
        <h3>3.1 User Locale</h3>
        <dl>
          <dt>Що це</dt>
          <dd>Особиста мова інтерфейсу користувача.</dd>
          <dt>Як налаштувати</dt>
          <dd>Оберіть зі списку потрібну локаль. Застосовується автоматично.</dd>
          <dt>На що впливає</dt>
          <dd>Тексти в UI підтягуються з глобального каталогу з ланцюжком fallback <code>en → parent → locale</code> і з орг‑перекриттями.</dd>
        </dl>
        <h3>3.2 UI Languages (org)</h3>
        <dl>
          <dt>Що це</dt>
          <dd>Список <em>доступних</em> UI‑мов вашої організації і мова за замовчуванням.</dd>
          <dt>Як налаштувати</dt>
          <dd>Додайте/видаліть коди локалей (напр., <code>en</code>, <code>uk</code>), оберіть <em>default</em>.</dd>
          <dt>Умова</dt>
          <dd>Локаль повинна існувати і бути <em>enabled</em> у системі.</dd>
          <dt>Вплив</dt>
          <dd>Визначає, які мови пропонувати користувачам і як працює fallback у вашій орг.</dd>
        </dl>
      </section>

      <section id="import-export">
        <h2>4) Import/Export</h2>
        <h3>4.1 Export</h3>
        <h4>Поля</h4>
        <dl>
          <dt>Namespace</dt>
          <dd>Розділ каталогу (напр., <code>sidebar</code>, <code>emails</code>). Оберіть зі списку.</dd>
          <dt>Locale</dt>
          <dd>Одна мова або (для адмінів) «всі локалі» при порожньому значенні. Для не‑адмінів — тільки локалі їхньої орг.</dd>
          <dt>Include overrides</dt>
          <dd>(Адмін) Додати орг‑перекриття у вивантаження.</dd>
          <dt>Overrides only</dt>
          <dd>(Не‑адмін) Застосовується автоматично: експортуються <strong>лише</strong> перекриття вашої орг.</dd>
          <dt>Format</dt>
          <dd>JSON (flat для однієї локалі або об’єкт per‑locale) або CSV.</dd>
        </dl>
        <h4>Результат</h4>
        <p>Отримаєте файл для аналізу або редагування в табличному/текстовому редакторі.</p>
        <details>
          <summary>Порада: коли використовувати CSV?</summary>
          <p>CSV зручно для одноразових правок у таблицях чи швидкого фільтрування. JSON — для складних скриптів/інтеграцій.</p>
        </details>

        <h3>4.2 Import (Async)</h3>
        <h4>Формати</h4>
        <pre><code>{`JSON (масив):
[
  { "namespace": "emails", "key": "welcome", "locale": "en", "value": "Welcome {name}" }
]

JSON (вкладений):
{
  "emails": {
    "welcome": { "en": "Welcome {name}", "uk": "Вітаємо {name}" }
  }
}

CSV (довгий):
namespace,key,locale,value
emails,welcome,en,Welcome {name}
`}</code></pre>
        <h4>Параметри</h4>
        <dl>
          <dt>Format</dt>
          <dd>Визначається автоматично за розширенням або вибором (JSON/CSV).</dd>
          <dt>Scope</dt>
          <dd>Org (для не‑адміна примусово) або Global (лише адмін).</dd>
          <dt>Preflight</dt>
          <dd>Перевіряє формат, ICU, існування/enable локалей, ліміти.</dd>
        </dl>
        <h4>Процес</h4>
        <ol>
          <li>Завантажте файл.</li>
          <li>Натисніть <strong>Перевірити</strong> (Preflight) і виправте попередження.</li>
          <li>Натисніть <strong>Start Job</strong> — відслідковуйте прогрес, переглядайте логи.</li>
        </ol>
        <details>
          <summary>Ліміти та поради</summary>
          <ul>
            <li>Payload ≤ 1MB; для великих обсягів — діліть на частини.</li>
            <li>Є обмеження активних задач/користувача та rate‑limits.</li>
            <li>ICU плейсхолдери мають збігатися з базовою <code>en</code>; за потреби підтвердіть <em>allowMismatch</em>.</li>
          </ul>
        </details>
      </section>

      <section id="keys">
        <h2>5) Keys (admin)</h2>
        <h4>Дії</h4>
        <ul>
          <li>Вибрати або створити <strong>Namespace</strong> (<em>+ Namespace</em>).</li>
          <li>Переглянути список ключів (віртуалізація для великих наборів).</li>
          <li>Додати новий ключ (поле внизу).</li>
        </ul>
        <h4>Вплив</h4>
        <p>Нові ключі стають доступними в <strong>Messages/Overrides</strong>. Версія глобального каталогу бампиться.</p>
      </section>

      <section id="messages">
        <h2>6) Messages (admin)</h2>
        <h4>Редагування</h4>
        <ul>
          <li>Оберіть <strong>Namespace</strong> та <strong>Locale</strong>.</li>
          <li>Внесіть зміни; збереження відбувається по <em>blur</em>.</li>
          <li>ICU: система порівнює плейсхолдери з <code>en</code>; різниці підсвічуються.</li>
        </ul>
        <h4>Вплив</h4>
        <p>Оновлює глобальні повідомлення; збільшує версію каталогу (ETag).</p>
      </section>

      <section id="overrides">
        <h2>7) Overrides (org)</h2>
        <h4>Редагування</h4>
        <ul>
          <li>Оберіть <strong>Namespace</strong> та <strong>Locale</strong>.</li>
          <li>Змініть текст; збереження по <em>blur</em>.</li>
          <li>ICU: перевірка проти глобального <code>en</code>.</li>
        </ul>
        <h4>Вплив</h4>
        <p>Перекриття заміщують глобальні значення для вашої орг; версія <em>org</em> каталогу бампиться.</p>
      </section>

      <section id="missing">
        <h2>8) Missing</h2>
        <p>Показує ключі/локалі без перекладу. Є масові дії для швидкого заповнення або експорту списку.</p>
      </section>

      <section id="audit">
        <h2>9) Audit</h2>
        <p>Журнал змін (хто/що/коли) з курсорною пагінацією для зручного відстеження історії.</p>
      </section>

      <section id="performance">
        <h2>10) Перформанс і кеш</h2>
        <ul>
          <li><strong>ETag/304</strong>: уникає зайвих завантажень.</li>
          <li><strong>Версії каталогу</strong>: інвалідовують кеш після змін.</li>
          <li><strong>Великі списки</strong>: курсорна пагінація, віртуалізація, skeleton‑рядки, sticky‑панелі.</li>
        </ul>
      </section>

      <section id="errors">
        <h2>11) Часті помилки і рішення</h2>
        <dl>
          <dt>unauthorized (401)</dt>
          <dd>Увійдіть у систему.</dd>
          <dt>forbidden (403)</dt>
          <dd>Недостатньо прав (global без admin або відсутнє членство в орг).</dd>
          <dt>invalid_locale</dt>
          <dd>Використайте існуючу та enabled локаль.</dd>
          <dt>icu_mismatch</dt>
          <dd>Вирівняйте плейсхолдери з <code>en</code> або підтвердіть <em>allowMismatch</em>.</dd>
          <dt>too_many_jobs / rate_limited</dt>
          <dd>Зачекайте потрібний час і повторіть.</dd>
          <dt>payload_too_large / too_many_items</dt>
          <dd>Розбийте імпорт на менші частини.</dd>
        </dl>
      </section>

      <section id="faq">
        <h2>12) FAQ і глосарій</h2>
        <h3>Чому я бачу лише «overridesOnly» на експорті?</h3>
        <p>Ви не Platform admin. Експорт для не‑адмінів обмежений перекриттями їхньої організації.</p>
        <h3>Глосарій</h3>
        <dl>
          <dt>Namespace</dt>
          <dd>Логічна група ключів (модуль інтерфейсу).</dd>
          <dt>Key</dt>
          <dd>Унікальний ідентифікатор тексту в межах namespace.</dd>
          <dt>Locale</dt>
          <dd>Код мови/регіону (напр., <code>en</code>, <code>uk</code>, <code>uk-UA</code>).</dd>
          <dt>Override</dt>
          <dd>Перекриття глобального повідомлення для конкретної організації.</dd>
          <dt>ICU</dt>
          <dd>Синтаксис змінних у рядках (напр., <code>{'{'}name{'}'}</code>, плюралізація тощо).</dd>
        </dl>
      </section>

      <section id="compliance">
        <h2>13) ICP — запуск і автоматизація</h2>
        <p><strong>I18n Compliance Pipeline (ICP)</strong> — це набір скриптів і перевірок, що гарантує відсутність “хардкодів” та синхронізацію каталогу.</p>

        <h3>Передумови</h3>
        <ul>
          <li>Node.js 20+; npm</li>
          <li>Доступ до Supabase (для <em>CI sync</em>)</li>
          <li>Змінні середовища (див. нижче)</li>
        </ul>

        <h3>Одноразова ініціалізація (локально)</h3>
        <pre><code className="language-bash">npm install
npx husky install
npm run i18n:extract
npm run i18n:sync
</code></pre>
        <ul>
          <li><kbd>i18n:extract</kbd> — збирає ключі з <code>t('ns.key', {'{}'}, {'{'} default: '…' {'}'})</code> у <code>public/i18n/en.json</code>.</li>
          <li><kbd>i18n:sync</kbd> — синхронізує <code>en.json</code> у БД (keys + en), бампить версію.</li>
        </ul>

        <h3>Щоденна робота (локально)</h3>
        <p>Husky <em>pre-commit</em> автоматично запустить <kbd>i18n:extract</kbd>. За потреби вручну:</p>
        <pre><code className="language-bash">{`npm run i18n:extract
git add public/i18n/en.json
npm run i18n:sync
`}</code></pre>

        <h3>CI (GitHub Actions)</h3>
        <p>На <em>PR</em> виконується екстракція; на гілці <code>main</code> — також <em>sync</em> у БД (потрібні secrets).</p>
        <details>
          <summary>Приклад конфігу</summary>
          <pre><code className="language-yaml">{`name: I18n Compliance Pipeline
on:
  pull_request: { branches: [ main ] }
  push: { branches: [ main ] }
jobs:
  icp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run i18n:extract
      - name: Sync to DB (main only)
        if: github.ref == 'refs/heads/main'
        env:
          SUPABASE_URL: ${'{{ secrets.SUPABASE_URL }}'}
          SUPABASE_SERVICE_ROLE_KEY: ${'{{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'}
        run: npm run i18n:sync
`}</code></pre>
        </details>

        <h3>Змінні середовища</h3>
        <pre><code className="language-bash">{`# .env.local (локально — тільки для розробки)
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
# Для CI: додайте як GitHub Secrets (НЕ комітити у репозиторій)
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
`}</code></pre>
        <p><mark>Увага:</mark> <code>SERVICE_ROLE_KEY</code> зберігайте лише у секретах CI/CD. Не комітьте у код.</p>

        <h3>Husky pre-commit (референс)</h3>
        <details>
          <summary>Файл <code>.husky/pre-commit</code></summary>
          <pre><code className="language-bash">#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run i18n:extract || exit 1

git add public/i18n/en.json

npm run lint || exit 1
</code></pre>
        </details>

        <h3>Траблшутінг</h3>
        <dl>
          <dt>en.json не оновлюється</dt>
          <dd>Перевірте, що усі тексти загорнуті у <code>t('ns.key', ..., { '{' } default: '...' { '}' })</code>. Скрипт шукає виклики <code>t()</code>.</dd>
          <dt>Sync падає у CI</dt>
          <dd>Додайте secrets <code>SUPABASE_URL</code> і <code>SUPABASE_SERVICE_ROLE_KEY</code> у налаштуваннях репозиторію.</dd>
          <dt>З’явились пропуски у перекладах</dt>
          <dd>Перевірте вкладку <strong>Missing</strong> і скористайтесь дією “Create from missing”.</dd>
        </dl>
      </section>

      <footer>
        <p><a href="#toc">⟲ Повернутися до змісту</a></p>
      </footer>
    </article>
  );
}
