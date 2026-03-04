import { motion } from "framer-motion";

export function MainMenu({ goSingleMode, goMultiMode }) {
  return (
    <div className="modeChooser">
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="modeBtn modeSingle"
        onClick={goSingleMode}
      >
        <span className="modeName">싱글플레이</span>
        <span className="modeDesc">랜덤 퍼즐 연습 모드</span>
      </motion.button>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="modeBtn modeMulti"
        onClick={goMultiMode}
      >
        <span className="modeName">멀티플레이</span>
        <span className="modeDesc">방 생성/참가 실시간 대결</span>
      </motion.button>
    </div>
  );
}
