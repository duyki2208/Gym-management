const router = require("express").Router();
const { live, ready } = require("../controllers/healthController");

router.get("/live", live);
router.get("/ready", ready);

module.exports = router;
