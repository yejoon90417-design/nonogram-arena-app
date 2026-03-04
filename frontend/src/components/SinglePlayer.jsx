import { Volume2, VolumeX } from "lucide-react";

export function SinglePlayer({
  selectedSize,
  setSelectedSize,
  loadRandomBySize,
  isLoading,
  soundOn,
  handleToggleSfx,
  backToMenu,
  isInRaceRoom,
}) {
  return (
    <div className="controls">
      {!isInRaceRoom && (
        <>
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
          >
            <option value="5x5">5x5</option>
            <option value="10x10">10x10</option>
            <option value="15x15">15x15</option>
            <option value="20x20">20x20</option>
            <option value="25x25">25x25</option>
          </select>
          <button onClick={loadRandomBySize} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load Random Size"}
          </button>
        </>
      )}
      <button onClick={handleToggleSfx}>
        {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        {soundOn ? "SFX ON" : "SFX OFF"}
      </button>
      <button onClick={backToMenu} disabled={isInRaceRoom}>
        메인으로
      </button>
    </div>
  );
}
