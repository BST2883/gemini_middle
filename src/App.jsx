import { Routes, Route } from "react-router-dom";
import MainPage from "./pages/MainPage";
import StudentLogin from "./pages/StudentLogin";
import StudentHome from "./pages/StudentHome";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CardView from "./pages/CardView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/student" element={<StudentLogin />} />
      <Route path="/student/home" element={<StudentHome />} />
      <Route path="/teacher" element={<TeacherLogin />} />
      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/card/:studentId" element={<CardView />} />
    </Routes>
  );
}
