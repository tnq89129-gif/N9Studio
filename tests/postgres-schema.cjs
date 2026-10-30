// npm install --no-save @electric-sql/pglite@0.3.14
// Generate schema first: dotnet run --project tests/DatabaseProviderChecks -- /path/to/generated
// node tests/postgres-schema.cjs /path/to/generated
const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const generated=process.argv[2];if(!generated)throw Error('Provide the generated schema directory.');
const schema=fs.readFileSync(path.join(generated,'postgres-schema.sql'),'utf8');
const upgrade=fs.readFileSync(path.resolve(__dirname,'../Backend/Sql/UpdatePostgreSql.sql'),'utf8');
async function runUpgrade(db){await db.exec("BEGIN; SET LOCAL lock_timeout = '15s'; SELECT pg_advisory_xact_lock(9129412026);");try{await db.exec(upgrade);await db.exec('COMMIT;');}catch(e){await db.exec('ROLLBACK;');throw e;}}
(async()=>{
 const db=new PGlite();await db.waitReady;await db.exec(schema);await runUpgrade(db);await runUpgrade(db);
 await db.query('INSERT INTO "AspNetUsers" ("Id","FullName","Address","EmailConfirmed","PhoneNumberConfirmed","TwoFactorEnabled","LockoutEnabled","AccessFailedCount") VALUES ($1,$2,$3,false,false,false,true,0)',['user-1','Test','']);
 const category=(await db.query('INSERT INTO "Categories" ("Name","Code","Description","IsActive") VALUES ($1,$2,$3,true) RETURNING "Id"',['Ao','ao',''])).rows[0].Id;
 const product=(await db.query('INSERT INTO "Products" ("Name","Description","Tag","ImageUrl","CategoryId","IsActive") VALUES ($1,$2,$3,$4,$5,true) RETURNING "Id"',['Ao test','Cotton','Moi','/images/7.jpg',category])).rows[0].Id;
 const variant=(await db.query('INSERT INTO "Variants" ("ProductId","Size","Color","Price","Stock","IsActive") VALUES ($1,$2,$3,$4,$5,true) RETURNING "Id"',[product,'M','Den',199000,5])).rows[0].Id;
 const query=fs.readFileSync(path.join(generated,'postgres-catalog-query.sql'),'utf8');assert((await db.query(query)).rows.length>=1);
 await assert.rejects(()=>db.query('INSERT INTO "Variants" ("ProductId","Size","Color","Price","Stock","IsActive") VALUES ($1,$2,$3,$4,$5,true)',[product,'M','Den',199000,5]),e=>e.code==='23505');
 await assert.rejects(()=>db.query('UPDATE "Variants" SET "Stock"=-1 WHERE "Id"=$1',[variant]),e=>e.code==='23514');
 await assert.rejects(()=>db.query('DELETE FROM "Categories" WHERE "Id"=$1',[category]),e=>e.code==='23503');
 await db.exec('BEGIN ISOLATION LEVEL SERIALIZABLE;');
 assert.equal((await db.query('UPDATE "Variants" SET "Stock"="Stock"-2 WHERE "Id"=$1 AND "Stock">=2 RETURNING "Stock"',[variant])).rows[0].Stock,3);
 const order=(await db.query('INSERT INTO "Orders" ("UserId","Recipient","Phone","Address","Note","CreatedAt","Status","Total") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "Id"',['user-1','Test','0347799850','Test','','2026-10-30T01:00:00Z','Pending',398000])).rows[0].Id;
 await db.query('INSERT INTO "OrderLines" ("OrderId","VariantId","ProductName","Size","Color","UnitPrice","Quantity") VALUES ($1,$2,$3,$4,$5,$6,$7)',[order,variant,'Ao test','M','Den',199000,2]);
 await db.exec('COMMIT;');
 assert.equal((await db.query('SELECT "Total" FROM "Orders" WHERE "UserId"=$1',['user-1'])).rows[0].Total,'398000.00');
 assert.equal((await db.query('SELECT * FROM "Orders" WHERE "UserId"=$1',['other-user'])).rows.length,0);
 await db.close();
 const legacy=new PGlite();await legacy.waitReady;
 await legacy.exec('CREATE TABLE "Categories" ("Id" integer PRIMARY KEY,"Name" text NOT NULL); CREATE TABLE "Products" ("Id" integer PRIMARY KEY,"Name" text NOT NULL,"CategoryId" integer NOT NULL REFERENCES "Categories"("Id")); INSERT INTO "Categories" VALUES (77,\'Old category\'); INSERT INTO "Products" VALUES (42,\'Old product\',77);');
 await runUpgrade(legacy);await runUpgrade(legacy);
 assert.equal((await legacy.query('SELECT "Code","IsActive" FROM "Categories" WHERE "Id"=77')).rows[0].Code,'danh-muc-77');
 assert.equal((await legacy.query('SELECT "Name","CategoryId","Tag" FROM "Products" WHERE "Id"=42')).rows[0].CategoryId,77);
 await legacy.close();
 console.log('PASS PostgreSQL engine (PGlite): full EF schema, repeated advisory-lock upgrades, legacy IDs/data retained, translated catalog query, unique/FK/check constraints, stock transaction and order snapshots. This does not test a remote PostgreSQL connection or Npgsql wire protocol.');
})().catch(e=>{console.error(e);process.exitCode=1;});
