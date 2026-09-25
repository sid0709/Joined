import { JobRoomRecord, RoomApplicationsMap } from "@/src/shared/types/job-room";

interface RoomThreadListProps {
  rooms: JobRoomRecord[];
  registry: RoomApplicationsMap;
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
}

export function RoomThreadList({ rooms, registry, selectedRoomId, onSelect }: RoomThreadListProps) {
  return (
    <div className="marketplace-selection-list">
      <p className="caption text-ink-muted">Room threads</p>
      {rooms.map((room) => (
        <button
          key={room.id}
          type="button"
          className={`marketplace-selection-item ${selectedRoomId === room.id ? "marketplace-selection-item-active" : ""}`}
          onClick={() => onSelect(room.id)}
        >
          <span className="body-strong marketplace-truncate">{room.title}</span>
          <span className="caption text-ink-muted">{registry[room.id]?.proposals.length ?? 0} applicants</span>
        </button>
      ))}
    </div>
  );
}
