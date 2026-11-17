// Run in mongosh using an account permitted to drop this database:
// mongosh "<connection URI>" --file scripts/drop-empty-taoo.mongosh.js
const unusedName = 'gympro_branch_taoo';
const catalog = db.getSiblingDB('gympro_central');
if (catalog.branches.findOne({ $or: [{ code: /^taoo$/i }, { dbName: unusedName }] })) {
  throw new Error('TAOO is registered. Refusing deletion.');
}
const unused = db.getSiblingDB(unusedName);
for (const name of unused.getCollectionNames()) {
  if (unused.getCollection(name).findOne({}) !== null) {
    throw new Error('Database contains data in ' + name + '. Refusing deletion.');
  }
}
const result = unused.dropDatabase();
if (result.ok !== 1) throw new Error('Database deletion failed: ' + JSON.stringify(result));
print('Deleted ' + unusedName);
