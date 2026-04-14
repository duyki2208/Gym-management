import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { staffService } from "../services/customerService";

const StaffDetailModal = ({ staff, onClose, isAdmin, onScheduleUpdate }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tính toán tuần hiện tại (bắt đầu từ Thứ 2)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const getDatesForWeek = (startDate) => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const weekDates = getDatesForWeek(currentWeekStart);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const startStr = weekDates[0].toLocaleDateString('en-CA'); // YYYY-MM-DD local
      const endStr = weekDates[6].toLocaleDateString('en-CA');

      const data = await staffService.getSchedules({
        startDate: startStr,
        endDate: endStr,
      });

      // Lọc schedule của riêng nhân viên này trong list trả về
      // (Do API lấy theo ngày, Backend trả về list theo ngày)
      const personalSchedules = data.filter(
        (s) => s.staff && (s.staff._id === (staff._id || staff.id) || s.staff === (staff._id || staff.id))
      );
      setSchedules(personalSchedules);
    } catch (e) {
      console.error(e);
      toast.error("Không lấy được lịch làm việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (staff) {
      fetchSchedules();
    }
  }, [staff, currentWeekStart]);

  const handleUpdateShift = async (dateStr, shiftType) => {
    if (!isAdmin) return;
    try {
      await staffService.updateSchedule(staff._id || staff.id, {
        date: dateStr,
        shiftType,
      });
      toast.success("Cập nhật ca làm thành công");
      fetchSchedules();
      if (onScheduleUpdate) onScheduleUpdate();
    } catch (error) {
      toast.error("Lỗi cập nhật lịch làm việc");
    }
  };

  const shiftOptions = ["Sáng", "Chiều", "Hành chính", "Nghỉ"];

  const getScheduleForDate = (dateStr) => {
    return schedules.find((s) => s.date === dateStr);
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-display">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative text-gray-800 dark:text-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-black uppercase tracking-wide text-blue-600 dark:text-blue-400">
            Hồ sơ Nhân viên
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col md:flex-row gap-8">
          {/* Thông tin cá nhân */}
          <div className="w-full md:w-1/3 flex flex-col items-center bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="w-32 h-32 rounded-full bg-blue-100 dark:bg-blue-900 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-6xl text-blue-500">
                badge
              </span>
            </div>
            <h3 className="text-xl font-bold mb-1 text-center">
              {staff.fullName || staff.name}
            </h3>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 mb-6">
              {staff.role === "manager"
                ? "Quản lý"
                : staff.role === "sale"
                ? "Sale"
                : staff.role === "pt"
                ? "PT"
                : staff.role === "reception"
                ? "Lễ tân"
                : staff.role}
            </span>

            <div className="w-full space-y-4">
              <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-xs font-bold text-gray-500 uppercase">
                  Ngày sinh
                </span>
                <span className="font-medium text-lg">
                  {staff.dob ? new Date(staff.dob).toLocaleDateString("vi-VN") : "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-xs font-bold text-gray-500 uppercase">
                  Số điện thoại
                </span>
                <span className="font-medium text-lg">{staff.phone || "N/A"}</span>
              </div>
              <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-xs font-bold text-gray-500 uppercase">
                  Chuyên môn
                </span>
                <span className="font-medium">{staff.specialty || "-"}</span>
              </div>
            </div>
          </div>

          {/* Lịch làm việc */}
          <div className="w-full md:w-2/3 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">
                  calendar_month
                </span>
                Lịch làm việc tuần
              </h3>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={prevWeek}
                  className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded drop-shadow-sm transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <span className="text-sm font-bold w-36 text-center">
                  {weekDates[0].toLocaleDateString("vi-VN")} -{" "}
                  {weekDates[6].toLocaleDateString("vi-VN")}
                </span>
                <button
                  onClick={nextWeek}
                  className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded drop-shadow-sm transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-10 text-center text-gray-500">
                  Đang tải lịch...
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3 text-sm font-bold text-gray-600 dark:text-gray-300 w-1/3">
                        Thứ / Ngày
                      </th>
                      <th className="p-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                        Ca làm (Sáng/Chiều/Full)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {weekDates.map((date, index) => {
                      // Tạo string date local cho đúng timezone
                      const dateStr = date.toLocaleDateString("en-CA");
                      const rawSchedule = getScheduleForDate(dateStr);
                      const shift = rawSchedule ? rawSchedule.shiftType : "Nghỉ";
                      const isTodayStr =
                        new Date().toLocaleDateString("en-CA") === dateStr;

                      return (
                        <tr
                          key={dateStr}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                            isTodayStr ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                          }`}
                        >
                          <td className="p-3 flex gap-3 items-center">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                isTodayStr
                                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                              }`}
                            >
                              {daysOfWeek[index]}
                            </span>
                            <div>
                              <div
                                className={`text-sm font-bold ${
                                  isTodayStr ? "text-blue-600 dark:text-blue-400" : ""
                                }`}
                              >
                                {date.getDate()}/{date.getMonth() + 1}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {isAdmin ? (
                              <select
                                className={`w-40 p-2 rounded-lg text-sm font-bold border transition-colors outline-none cursor-pointer ${
                                  shift === "Nghỉ"
                                    ? "bg-white text-gray-500 border-gray-200"
                                    : shift === "Sáng"
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : shift === "Chiều"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                }`}
                                value={shift}
                                onChange={(e) =>
                                  handleUpdateShift(dateStr, e.target.value)
                                }
                              >
                                {shiftOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold border ${
                                  shift === "Nghỉ"
                                    ? "bg-gray-100 text-gray-500 border-transparent"
                                    : shift === "Sáng"
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : shift === "Chiều"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                }`}
                              >
                                {shift}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {!isAdmin && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                *Chỉ quản trị viên mới có thể xếp lịch làm việc
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDetailModal;
