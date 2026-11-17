/** The former migration only copied users and incorrectly retained the legacy DB.
 * The replacement previews by default and backs up all collections before applying.
 */
require('./migrate-hn01-database').main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
