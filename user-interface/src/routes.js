// import
import Projects from "views/Projects/Projects";
import MainPage from "views/MainPage/MainPage.js"; // MainPage 추가
import About from "views/About/About.js"; // About 추가

import { HomeIcon, StatsIcon, DocumentIcon } from "components/Icons/Icons";

var dashRoutes = [
  {
    path: "/main",
    name: "Home",
    icon: <HomeIcon color="inherit" />, // MainPage 아이콘
    component: MainPage,
    layout: "/admin", // MainPage는 별도의 레이아웃 사용 가능
  },
  {
    path: "/projects",
    name: "Projects",
    icon: <StatsIcon color="inherit" />,
    component: Projects, // Projects는 Dashboard로 연결
    layout: "/admin",
  },
  {
    path: "/about",
    name: "About us",
    icon: <DocumentIcon color="inherit" />,
    component: About,
    layout: "/admin",
  },
];
export default dashRoutes;
