/**
 * routes/index.js — Router trung tâm
 * Tất cả routes đều được mount tại đây với prefix /api/v1/
 */
const router = require('express').Router();
const { authenticate } = require('../middleware/accessTokenContext');
const resolveTenant = require('../middleware/resolveTenant');
const loadTenantContext = require('../middleware/loadTenantContext');
const auditLogger = require('../middleware/auditLogger');

// 1. Verify access token once (optional for public routes).
router.use(authenticate);

// 2. Resolve tenant without touching the database.
router.use(resolveTenant);

// 3. Load the selected tenant context.
router.use(loadTenantContext);

// 4. Kích hoạt audit logger cho tất cả các thao tác thay đổi dữ liệu
router.use(auditLogger);

// 5. Mount các routes chức năng
router.use('/auth',             require('./authRoutes'));
router.use('/customers',        require('./customerRoutes'));
router.use('/packages',         require('./packageRoutes'));
router.use('/staff',            require('./staffRoutes'));
router.use('/checkins',         require('./checkInRoutes'));
router.use('/workouts',         require('./workoutRoutes'));
router.use('/dashboard',        require('./dashboardRoutes'));
router.use('/reports',          require('./reportRoutes'));
router.use('/products',         require('./productRoutes'));
router.use('/inventory',        require('./inventoryRoutes'));
router.use('/pos',              require('./posRoutes'));
router.use('/notifications',    require('./notificationRoutes'));
router.use('/settings',         require('./settingRoutes'));
router.use('/commissions',      require('./commissionRoutes'));
router.use('/kpi',              require('./kpiRoutes'));
router.use('/team-tasks',       require('./teamTaskRoutes'));
router.use('/audit-logs',       require('./auditRoutes'));
router.use('/leads',            require('./leadRoutes'));
router.use('/upload',           require('./uploadRoutes'));
router.use('/search',           require('./searchRoutes'));
router.use('/branch-transfers', require('./branchTransferRoutes'));
router.use('/closures',         require('./closureRoutes'));

module.exports = router;
