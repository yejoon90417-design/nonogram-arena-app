export function AuthScreen({
  authTab,
  setAuthTab,
  backToMenu,
  loginUsername,
  setLoginUsername,
  loginPassword,
  setLoginPassword,
  loginError,
  setLoginError,
  loginFieldErrors,
  setLoginFieldErrors,
  login,
  signupUsername,
  setSignupUsername,
  signupNickname,
  setSignupNickname,
  signupPassword,
  setSignupPassword,
  signupError,
  setSignupError,
  signupFieldErrors,
  setSignupFieldErrors,
  signup,
  isLoading,
}) {
  return (
    <div className="authScreen">
      <div className="authTabs">
        <button
          className={authTab === "login" ? "active" : ""}
          onClick={() => {
            setAuthTab("login");
            setLoginError("");
            setLoginFieldErrors({ username: "", password: "" });
          }}
        >
          로그인
        </button>
        <button
          className={authTab === "signup" ? "active" : ""}
          onClick={() => {
            setAuthTab("signup");
            setSignupError("");
            setSignupFieldErrors({ username: "", nickname: "", password: "" });
          }}
        >
          회원가입
        </button>
        <button onClick={backToMenu}>메인으로</button>
      </div>

      {authTab === "login" && (
        <div className="authCard">
          <label>
            아이디
            <input
              type="text"
              className={loginFieldErrors.username ? "fieldError" : ""}
              value={loginUsername}
              onChange={(e) => {
                setLoginUsername(e.target.value);
                setLoginFieldErrors((prev) => ({ ...prev, username: "" }));
                if (loginError) setLoginError("");
              }}
              placeholder="아이디"
            />
            {loginFieldErrors.username && (
              <span className="fieldErrorText">
                {loginFieldErrors.username}
              </span>
            )}
          </label>
          <label>
            비밀번호
            <input
              type="password"
              className={loginFieldErrors.password ? "fieldError" : ""}
              value={loginPassword}
              onChange={(e) => {
                setLoginPassword(e.target.value);
                setLoginFieldErrors((prev) => ({ ...prev, password: "" }));
                if (loginError) setLoginError("");
              }}
              placeholder="비밀번호"
            />
            {loginFieldErrors.password && (
              <span className="fieldErrorText">
                {loginFieldErrors.password}
              </span>
            )}
          </label>
          {loginError && <div className="modalError">{loginError}</div>}
          <div className="modalActions">
            <button onClick={backToMenu}>취소</button>
            <button
              onClick={login}
              disabled={isLoading || !loginUsername.trim() || !loginPassword}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </div>
      )}

      {authTab === "signup" && (
        <div className="authCard">
          <label>
            아이디
            <input
              type="text"
              className={signupFieldErrors.username ? "fieldError" : ""}
              value={signupUsername}
              onChange={(e) => {
                setSignupUsername(e.target.value);
                setSignupFieldErrors((prev) => ({ ...prev, username: "" }));
                if (signupError) setSignupError("");
              }}
              placeholder="아이디(3~24자)"
            />
            {signupFieldErrors.username && (
              <span className="fieldErrorText">
                {signupFieldErrors.username}
              </span>
            )}
          </label>
          <label>
            닉네임
            <input
              type="text"
              className={signupFieldErrors.nickname ? "fieldError" : ""}
              value={signupNickname}
              onChange={(e) => {
                setSignupNickname(e.target.value);
                setSignupFieldErrors((prev) => ({ ...prev, nickname: "" }));
                if (signupError) setSignupError("");
              }}
              placeholder="닉네임"
            />
            {signupFieldErrors.nickname && (
              <span className="fieldErrorText">
                {signupFieldErrors.nickname}
              </span>
            )}
          </label>
          <label>
            비밀번호
            <input
              type="password"
              className={signupFieldErrors.password ? "fieldError" : ""}
              value={signupPassword}
              onChange={(e) => {
                setSignupPassword(e.target.value);
                setSignupFieldErrors((prev) => ({ ...prev, password: "" }));
                if (signupError) setSignupError("");
              }}
              placeholder="영문+숫자 포함 8자 이상"
            />
            {signupFieldErrors.password && (
              <span className="fieldErrorText">
                {signupFieldErrors.password}
              </span>
            )}
          </label>
          {signupError && <div className="modalError">{signupError}</div>}
          <div className="modalActions">
            <button onClick={backToMenu}>취소</button>
            <button
              onClick={signup}
              disabled={
                isLoading ||
                !signupUsername.trim() ||
                !signupNickname.trim() ||
                !signupPassword
              }
            >
              {isLoading ? "가입 중..." : "회원가입"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
