# Технічна Документація: PIM SaaS Платформа  
**Версія:** 1.5 (оновлено 12.08.2025)

---

## 1. Загальна Концепція та Архітектура

### 1.1. Мета Проєкту
Створення гнучкої, мультиорендної (multi-tenant) SaaS-платформи для керування інформацією про продукти (PIM). Система дозволяє користувачам централізовано зберігати, збагачувати та синхронізувати дані про товари, використовуючи потужні інструменти для структурування каталогу, мультимодального AI-аналізу, генерації контенту, а також професійного керування медіафайлами.

### 1.2. Ключові Принципи Архітектури
- **Multi-tenancy:** Повна ізоляція даних кожного клієнта (організації) на рівні бази даних за допомогою Row-Level Security (RLS).
- **API-First:** Вся логіка доступна через API.
- **AI-Oriented:** Глибока інтеграція з AI для автоматизації аналізу, структурування та генерації даних.
- **Гнучка структура даних:** Підтримка динамічних ієрархій та атрибутів.
- **Поділ відповідальності:** Чітке розмежування між бекендом (Supabase) та фронтендом (Next.js).

---

## 2. Архітектура Бази Даних (PostgreSQL Schema)

### 2.1. Огляд
Схема спроєктована для забезпечення максимальної гнучкості та продуктивності.

### 2.2. Основні Таблиці

**Керування Доступом та Організаціями**  
- `organizations`, `profiles`, `organization_members`

**Ядро PIM: Ієрархія та Продукти**  
- `group_types`, `groups`, `items`

**Довідники та Складні Характеристики (Bill of Materials)**  
- `features`, `feature_relationships`, `item_features`

### 2.3. Системні та Контентні Таблиці

**Керування Контентом та AI**  
- `content_entries`, `ai_prompts`

**Аудит та Історія**  
- `audit_logs`

**(Нові таблиці цього розділу)**  
- `content_entry_versions` — версіонування контенту (append-only, зв’язок 1:N із `content_entries`).  
- `ai_runs` — журнал виконання AI-операцій (модель, провайдер, токени/вартість, статус, таймінги, помилки).  
- `outbox_events` — гарантована доставка інтеграційних подій (webhooks/експорти) за патерном Outbox.  
- `jobs` — черга фонових задач (рендерінг зображень, embeddings, масові імпорти).

### 2.4. Керування Медіафайлами (Оновлено)

**Таблиця:** `media_assets` — зберігає метадані про всі завантажені файли та їхні версії (рендерінги).  

| Колонка | Тип | Опис |
|---|---|---|
| id | uuid | Primary Key |
| organization_id | uuid | FK |
| item_id | uuid | FK до `items.id` (опціонально) |
| parent_asset_id | uuid | Self-FK на оригінал, якщо це рендерінг |
| asset_type | text | Тип: `original` \| `display` \| `thumbnail` |
| storage_path | text | Шлях у бакеті (напр., `originals/sha256/..../file.tif`) |
| storage_bucket | text | Назва бакету (напр., `pim-originals-cold`) |
| mime_type | text | MIME (image/jpeg ...) |
| file_size | bigint | Розмір у байтах |
| metadata | jsonb | Розміри, EXIF, колірний профіль тощо |
| checksum_sha256 | text | Контрольна сума для дедуплікації |
| created_at | timestamptz | Дата створення |
| updated_at | timestamptz | Дата оновлення |
| public_url | text | (необов’язкове/застаріваюче поле) — **рекомендація:** формувати URL динамічно з `storage_bucket + storage_path` |

**Індекси та обмеження:**  
- `create index on media_assets(organization_id, item_id);`  
- `create index on media_assets(parent_asset_id);`  
- `create unique index on media_assets(organization_id, checksum_sha256);`  
- Унікальність рендерінгів за комбінацією: `(organization_id, parent_asset_id, asset_type, (metadata->>'width'), (metadata->>'height'))`.

**Політика зберігання:** оригінали у «cold», вітринні — у «hot». Signed URL для оригіналів (TTL 24h).

### 2.5. Безпека на Рівні Рядків (Row-Level Security)

Політики застосовуються до всіх бізнес-таблиць, включно з `media_assets`. Кожна таблиця має `organization_id uuid not null` та індекс по ньому. JWT містить клейм `org_id`.

**Шаблони політик (приклад для `items`):**
```sql
alter table items enable row level security;

create policy org_read on items for select
  using (organization_id = auth.jwt()->>'org_id');

create policy org_insert on items for insert
  with check (organization_id = auth.jwt()->>'org_id');

create policy org_update on items for update
  using (organization_id = auth.jwt()->>'org_id')
  with check (organization_id = auth.jwt()->>'org_id');
```

Також у кожній таблиці: `created_at`, `updated_at` із тригером автооновлення.

### 2.6. (Новий розділ) Модель Атрибутів KeyFeatures → Продукти

**Мета:** будувати керовані випадаючі списки на базі словника, підтримати `single`, `multi`, `cascade` і сценарії BOM.

**Таблиці:**
- `feature_attributes (id, organization_id, code, label, root_feature_id, control_type, sort_order)`  
- `item_features (item_id, feature_attribute_id, feature_term_id, ... )` — pivot із PK `(item_id, feature_attribute_id, feature_term_id)`  
- `feature_relationships (parent_id, child_id, edge_type, sort_order, quantity, unit)` — `edge_type`: `narrower`, `broader`, `part_of` тощо.

**Принцип роботи:**  
- Опції `<select>` — це діти `root_feature_id` (для `cascade` — наступні рівні).  
- `multi` — кілька рядків у `item_features` для однієї пари `(item, feature_attribute)`.

### 2.7. (Новий розділ) Індексація та Продуктивність

Обов’язкові індекси:  
- на всіх таблицях: `(organization_id)`;  
- на всіх FK: окремі btree-індекси;  
- `item_features`: `(item_id, feature_attribute_id)`, `(feature_attribute_id, feature_term_id)`;  
- `feature_relationships`: `(parent_id, child_id, edge_type, sort_order)`;  
- `media_assets`: див. 2.4.

Пошук:  
- Повнотекстовий `tsvector` (`products.search`) + `GIN` індекс.  
- `pg_trgm` для `ILIKE '%...'`.  
- `pgvector` + `ivfflat`/HNSW для семантичного пошуку по описах/атрибутах.

---

## 3. Ключові Робочі Процеси

### 3.1. Керування Зображеннями (Оновлено)
Стратегія обробки зображень розділена на три рівні для оптимізації швидкості та витрат.

1) **Рівень 1: Оригінали (Cold Storage)**  
Призначення: Зберігання майстер-копій у високій якості (RAW, TIFF, PSD, >2MB) для архіву та майбутніх перетворень.  
Сховище: «Холодний» бакет у Supabase Storage (S3-сумісний) або Cloudflare R2 з політикою життєвого циклу `INFREQUENT_ACCESS`.  
Доступ: через Edge Function із коротким signed URL (24h).

2) **Рівень 2: Вітринні Розміри (Hot Storage)**  
Оптимізовані зображення (≈1280px, WebP/JPEG) для UI. Публічне сервування через CDN.

3) **Рівень 3: Мініатюри (Hot / On-the-fly)**  
≤400px, WebP, довге кешування (`max-age=31536000`).

**Робочий процес завантаження:**  
Завантаження → cold → подія/черга → рендерінги (Sharp) → hot → записи в `media_assets` (оригінал + рендерінги через `parent_asset_id`).

### 3.2. Мультимодальна AI-генерація контенту
Процес незмінний, але використовує URL із «вітринного» розміру. Результат — структурований JSON у `content_entries` із можливістю порівняння й затвердження.

### 3.3. (Новий розділ) Черги та Фонова Обробка (Jobs)
- **Таблиця `jobs`:** `id, organization_id, kind ('image_derivative'|'embedding'|'import'|...), payload jsonb, status ('queued'|'running'|'done'|'error'), started_at, finished_at, error`.  
- **Воркер:** періодично знімає задачі, виконує, оновлює статус.  
- **Ідempotentність:** `checksum`/унікальні ключі, ретраї з backoff.  
- **Моніторинг:** дашборд черги (довжина, p95 виконання, відсоток помилок).

### 3.4. AI-Аналіз та Структурування Контенту
Без змін, але:  
- Вести **`ai_runs`** з токенами/вартістю/часом.  
- Зберігати `source_json` (людина) та `ai_json` (модель), мати режим «Compare & Approve».

### 3.5. (Новий розділ) Пошук, Збережені Запити та Масова Заміна
- **Saved Searches:** `saved_searches(id, organization_id, name, resource, rules jsonb, created_by, created_at)` — JSON правил для побудови складних (AND/OR/omit) запитів.  
- **RPC для пошуку:** `search_products(organization_id, rules jsonb)` — приймає набір умов та повертає результат.  
- **Масова заміна з попереднім переглядом:** RPC `bulk_replace_descriptions(_tenant, _pattern, _replacement, _where_brand[], _dry_run boolean)` — попередній перегляд (`dry_run=true`) і транзакційне застосування змін.

### 3.6. (Новий розділ) Інтеграції та Outbox Pattern
- **`outbox_events`** (append-only) + воркер доставки (retry/backoff).  
- Канали: вебхуки, API партнера, експорт CSV/JSON.  
- Гарантія «at-least-once», ідемпотентні хендлери на стороні отримувача.

### 3.7. (Новий розділ) Версіонування Контенту та Публікація
- `content_entry_versions`: знімки змін (1:N).  
- `content_entries`: стани `draft|approved|published`, `version int`, `approved_by`, `approved_at`.  
- Публікація у зовнішні системи через Outbox.

---

## 4. План Розробки (Roadmap)

### Етап 1: MVP (Minimum Viable Product)
**Мета:** Створити ядро системи для керування структурою каталогу.  
**Функціонал:**  
- Автентифікація, створення організацій, налаштування RLS.  
- CRUD для `group_types`, `groups`, `items`.  
- CRUD для `content_entries` для ручного введення багатомовного контенту.  
- Візуальний редактор ієрархії каталогу.  
- Базовий імпорт/експорт даних у CSV.  

**Definition of Done (DoD):**  
- RLS-політики на всіх таблицях + smoke-тести.  
- Імпорт/експорт CSV з валідацією та прев’ю помилок.  
- 1 тенант, ≥1k SKU, p95 API < 200 мс.

### Етап 2: Робочий Прототип (Working Prototype)
**Мета:** Додати інтелектуальні функції та автоматизацію.  
**Функціонал:**  
- (Нове) Система керування медіафайлами (завантаження, рендерінги, hot/cold).  
- Інтеграція з зовнішніми API через Edge Functions.  
- CRUD для `ai_prompts`.  
- Мультимодальна генерація контенту.  
- Налаштування pgvector, ембединги для `items`.  
- Семантичний пошук по каталогу.  
- Реалізація довідників (BOM).  
- Базова реалізація `audit_logs`.  
- Функція «AI-аналізу» з тексту.  

**DoD:**  
- Пайплайн медіа з чергою, дедупом і TTL.  
- pgvector + top-k пошук.  
- Мінімальний workflow «AI draft → approve → publish».  
- Audit на insert/update/delete.

### Етап 3: Публічний Реліз
(План залишається без змін)  
**Додатково DoD:**  
- Білінг (Stripe) з тарифами/квотами (Storage, egress, AI-виклики).  
- Ролі/права (Owner, Admin, Editor, Viewer).  
- Моніторинг/тривоги: аптайм, помилки функцій, метрики черги.

---

## 5. Технологічний Стек та Сервіси
(Без змін: Supabase, Next.js, Vercel, GitHub, PostgreSQL, Tailwind CSS, Appsmith/Retool, Docker)

---

## 6. (Новий розділ) Нотатки з Експлуатації
- **URL-політика:** не зберігати `public_url` в БД; формувати при видачі.  
- **JWT:** містить `org_id`, `role`, час життя; сервісні ключі — мінімально.  
- **Backups/DR:** регулярні бекапи БД; періодична перевірка відновлення; sync медіа між бакетами.  
- **Логи/Аудит:** централізований збір, кореляція з `ai_runs`, `jobs`, `outbox_events`.