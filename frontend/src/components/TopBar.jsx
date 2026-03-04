import { LogIn, UserPlus } from "lucide-react";

export function TopBar({
  isLoggedIn,
  authUser,
  logout,
  openAuthScreen,
  isModeAuth,
}) {
  return (
    <div className="topBar">
      <div>
        <h1 className="title">Nonogram Arena</h1>
        <p className="lead">
          드래그로 그리는 타임어택 픽셀 전투. 싱글 연습 후 멀티에서
          경쟁하세요.
        </p>
      </div>
      {!isModeAuth && (
        <div className="topAuth">
          {isLoggedIn ? (
            <>
              <span className="userChip">
                {authUser.nickname} ({authUser.username})
              </span>
              <button onClick={logout}>로그아웃</button>
            </>
          ) : (
            <>
              <button onClick={() => openAuthScreen("login", "menu")}>
                <LogIn size={15} /> 로그인
              </button>
              <button onClick={() => openAuthScreen("signup", "menu")}>
                <UserPlus size={15} /> 회원가입
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
