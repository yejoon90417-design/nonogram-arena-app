import { Volume2, VolumeX } from "lucide-react";

export function MultiplayerLobby({
  isLoading,
  roomsLoading,
  publicRooms,
  soundOn,
  handleToggleSfx,
  backToMenu,
  isInRaceRoom,
  setShowCreateModal,
  setCreateRoomTitle,
  setCreateSize,
  selectedSize,
  setCreateMaxPlayers,
  setCreateVisibility,
  setCreatePassword,
  setShowJoinModal,
  setJoinRoomType,
  setJoinPassword,
  fetchPublicRooms,
  setJoinRoomCode,
}) {
  return (
    <>
      <div className="controls">
        <button onClick={handleToggleSfx}>
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {soundOn ? "SFX ON" : "SFX OFF"}
        </button>
        <button onClick={backToMenu} disabled={isInRaceRoom}>
          메인으로
        </button>
      </div>

      <div className="racePanel">
        {!isInRaceRoom && (
          <>
            <button
              onClick={() => {
                setCreateRoomTitle("");
                setCreateSize(selectedSize);
                setCreateMaxPlayers("2");
                setCreateVisibility("public");
                setCreatePassword("");
                setShowCreateModal(true);
              }}
              disabled={isLoading}
            >
              방 만들기
            </button>
            <button
              onClick={() => {
                setJoinRoomType("unknown");
                setJoinPassword("");
                setShowJoinModal(true);
              }}
              disabled={isLoading}
            >
              Join Room
            </button>
            <button onClick={fetchPublicRooms} disabled={roomsLoading}>
              {roomsLoading ? "목록 불러오는 중..." : "오픈방 새로고침"}
            </button>
          </>
        )}
      </div>

      <div className="raceStateBox">
        <div>
          <b>방 리스트</b>
        </div>
        {publicRooms.length === 0 ? (
          <div>입장 가능한 방이 없습니다.</div>
        ) : (
          <div className="roomList">
            {publicRooms.map((room) => (
              <div className="roomRow" key={room.roomCode}>
                <span>
                  <span
                    className={`roomBadge ${
                      room.isPrivate ? "private" : "public"
                    }`}
                  >
                    {room.isPrivate ? "LOCK" : "OPEN"}
                  </span>{" "}
                  [{room.roomCode}] {room.roomTitle} ({room.width}x{room.height}){" "}
                  {room.currentPlayers}/{room.maxPlayers}
                </span>
                <button
                  onClick={() => {
                    setJoinRoomCode(room.roomCode);
                    setJoinRoomType(room.isPrivate ? "private" : "public");
                    setJoinPassword("");
                    setShowJoinModal(true);
                  }}
                >
                  참가
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
