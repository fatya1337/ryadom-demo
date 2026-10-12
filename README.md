# Рядом — самостоятельный показ

https://fatya1337.github.io/ryadom-demo/

Публичная статическая демонстрация: обзор проделанной работы, три снимка локального
стенда с API и интерактивные кабинеты специалиста (/showcase) и пациента (/patient).
Вымышленные данные живут только в памяти вкладки до перезагрузки. Кабинеты независимы;
учебные приглашения не дают реальный доступ. /live здесь тоже демонстрационный.
Нет подключения к API, регистрации, cookie-сессий, БД и сохранения данных в browser storage.
Не вводите настоящие медицинские данные. Скриншоты содержат только учебные примеры.

Полная версия с PostgreSQL / Prisma / Better Auth находится в закрытых репозиториях
barmood-team/platform-doctor (feat/shared-backend) и platform-biplyar (feat/patient-live).
Срез проверки: 12.10.2026, doctor e6df4e4639926f346bb9242986635c4e65e660ac,
patient 8d0d3a124da7e900c7c4aa267b4179191185d93e. 15 unit + 17 integration прошли.
Ссылки на PR и CI размещены на стартовой странице; нужен доступ к организации.

## Запуск
npm ci
npm run dev

## Статическая сборка
STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/ryadom-demo npm run build

GitHub Actions публикует out/ после push в main. Backend, аккаунты и .env сюда не копировать.
lib/client.ts — только браузерные типы/транспорт, не сервер. В кабинетах используются
app/live/demo.ts и app/patient/demo-client.ts; не заменять их реальным API незаметно.
