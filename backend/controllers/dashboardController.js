const Customer = require("../models/Customer");
const CheckIn = require("../models/CheckIn");
const Invoice = require("../models/Invoice");
const Setting = require("../models/Setting");
const TeamTask = require("../models/TeamTask");
const {
  startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, eachDayOfInterval, format, startOfMonth, endOfMonth
} = require("date-fns");

const getStats = async (req, res) => {
  try {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const yesterday = subDays(today, 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    
    // Tuần này (Thứ 2 -> Chủ Nhật)
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // 1 là thứ 2
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });

    // Format ngày hôm nay
    const todayStr = format(today, "yyyy-MM-dd");

    // 1. Lấy cấu hình hệ thống (để có target doanh thu)
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
      await setting.save();
    }
    const targetRevenue = setting.targetRevenue || 100000000; // Mặc định 100 triệu

    // 2. Chạy các truy vấn song song để tối ưu hiệu năng
    const [
      newCustomersCount,
      uniqueCheckInCustomerIds,
      uniqueCheckInYesterdayCustomerIds,
      todayCheckInDocs,
      revenueAggregation,
      weeklyRevenueAggregation,
      newCustomersList,
      todayTasks,
      recentCheckIns
    ] = await Promise.all([
      // Đếm hội viên mới trong tháng hiện tại (dựa trên startDate)
      Customer.countDocuments({ startDate: { $gte: thisMonthStart, $lte: thisMonthEnd } }),
      
      // Lấy danh sách ID khách hàng check-in độc nhất hôm nay
      CheckIn.distinct("customerId", { time: { $gte: todayStart, $lte: todayEnd } }),
      
      // Lấy danh sách ID khách hàng check-in độc nhất hôm qua
      CheckIn.distinct("customerId", { time: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      
      // Lấy toàn bộ lượt check-in hôm nay để vẽ biểu đồ giờ cao điểm
      CheckIn.find({ time: { $gte: todayStart, $lte: todayEnd } }).lean(),
      
      // Tính doanh thu thực tế từ Invoice (loại bỏ hóa đơn chưa thanh toán)
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
            paymentStatus: "paid"
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" }
          }
        }
      ]),

      // Lấy doanh thu từng ngày trong tuần này
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd },
            paymentStatus: "paid"
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" }
          }
        }
      ]),

      // Lấy danh sách 20 hội viên đăng ký mới gần nhất trong tháng hiện tại
      Customer.find({ startDate: { $gte: thisMonthStart, $lte: thisMonthEnd } })
        .select("name code phone packageType startDate avatar price")
        .sort({ startDate: -1 })
        .limit(20)
        .lean(),

      // Lấy toàn bộ công việc chưa hoàn thành hôm nay để phân tích
      TeamTask.find({ date: todayStr, isCompleted: false }).lean(),
      
      // Lấy 5 hoạt động check-in gần nhất cho panel vận hành
      CheckIn.find().sort({ time: -1 }).limit(5).lean()
    ]);

    const todayCheckInsCount = uniqueCheckInCustomerIds.length;
    const yesterdayCheckInsCount = uniqueCheckInYesterdayCustomerIds.length;
    const checkInChange = todayCheckInsCount - yesterdayCheckInsCount;
    
    const revenueThisMonth = revenueAggregation[0]?.totalRevenue || 0;
    
    // Tính % hoàn thành chỉ tiêu doanh thu
    const revenuePercentage = Math.round((revenueThisMonth / targetRevenue) * 100);

    // Tính số việc chưa hoàn thành và tìm việc cận giờ
    const pendingTasksCount = todayTasks.length;
    
    // Quy đổi giờ bắt đầu theo mốc 5h sáng chuẩn ca trực
    const getStartTime = (timeSlot) => {
      if (!timeSlot) return null;
      const match = timeSlot.match(/(\d+)(?::(\d+))?/);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minute = match[2] ? parseInt(match[2], 10) : 0;
        if (hour < 5) {
          hour += 24; // Đẩy mốc 0h-4h sáng xuống sau 23h đêm
        }
        return { hour, minute };
      }
      return null;
    };

    const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
    const vnTime = new Date(utc + (3600000 * 7));
    const currentHour = vnTime.getHours();
    const currentMinute = vnTime.getMinutes();
    
    // Quy đổi giờ hiện tại theo mốc 5h sáng chuẩn ca trực
    let currentHourShift = currentHour;
    if (currentHourShift < 5) {
      currentHourShift += 24;
    }
    const currentTotalMinutes = currentHourShift * 60 + currentMinute;

    let upcomingTask = null;
    let minTaskMinutes = Infinity;

    todayTasks.forEach(task => {
      const taskTime = getStartTime(task.timeSlot);
      if (taskTime) {
        const taskTotalMinutes = taskTime.hour * 60 + taskTime.minute;
        const diff = taskTotalMinutes - currentTotalMinutes;
        // Việc cận giờ: trước giờ bắt đầu <= 30 phút và chưa hoàn thành, nhưng trễ không quá 5 phút (nếu trễ > 5p sẽ bị khóa)
        if (diff <= 30 && diff >= -5) {
          if (taskTotalMinutes < minTaskMinutes) {
            minTaskMinutes = taskTotalMinutes;
            upcomingTask = task;
          }
        }
      }
    });

    // Map doanh thu tuần này
    const allDaysInWeek = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd });
    const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    const weeklyRevenue = allDaysInWeek.map((day, idx) => {
      const formattedDate = format(day, "yyyy-MM-dd");
      const found = weeklyRevenueAggregation.find(r => r._id === formattedDate);
      return {
        dayName: dayNames[idx] || format(day, "EEEE"),
        date: formattedDate,
        revenue: found ? found.revenue : 0
      };
    });

    // Tính toán giờ cao điểm hôm nay (Peak Hours)
    const hoursCount = new Array(24).fill(0);
    todayCheckInDocs.forEach((doc) => {
      const hour = new Date(doc.time).getHours();
      if (!isNaN(hour)) hoursCount[hour]++;
    });

    const peakHours = hoursCount.slice(6, 22).map((count, i) => ({
      hour: i + 6,
      count,
    }));

    res.json({
      success: true,
      data: {
        revenue: revenueThisMonth,
        targetRevenue: targetRevenue,
        revenuePercentage: revenuePercentage,
        newCustomersThisMonth: newCustomersCount,
        newCustomersList: newCustomersList,
        todayCheckIns: todayCheckInsCount,
        yesterdayCheckIns: yesterdayCheckInsCount,
        checkInChange: checkInChange,
        weeklyRevenue: weeklyRevenue,
        pendingTasksCount: pendingTasksCount,
        upcomingTask: upcomingTask ? {
          _id: upcomingTask._id,
          timeSlot: upcomingTask.timeSlot,
          task: upcomingTask.task
        } : null,
        peakHours: peakHours,
        recentActivities: recentCheckIns.map(ci => ({
          id: ci._id,
          customerName: ci.customerName,
          time: ci.time,
          type: ci.type || 'in'
        }))
      }
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Lỗi lấy dữ liệu thống kê tổng quan" });
  }
};

module.exports = { getStats };
