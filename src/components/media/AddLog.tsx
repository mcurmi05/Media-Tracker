import "../../styles/media/AddLog.css";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLogs } from "../../contexts/UserLogsContext";
import { supabase } from "../../services/supabase-client";
import { upsertMovie, resolveFullMovie } from "../../services/movieMetadata";
import LogModal from "./LogModal";

export default function AddLog({ movie }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { addLog, removeLog } = useLogs();

  const [creating, setCreating] = useState(false);
  // The freshly created log being edited in the modal: { logId, entryId, full }.
  const [editing, setEditing] = useState(null);

  // Create a fresh log row for this title, then open the editor modal on it.
  // Rewatches just stack another log.
  async function createLog() {
    setCreating(true);

    // Ensure full metadata (browse cards only carry tmdb_id), cache it in the
    // shared media table, and reference it by uuid.
    const full =
      movie.tmdb_id != null && movie.id ? movie : await resolveFullMovie(movie);
    const movieEntryId = await upsertMovie(full);

    const { data, error } = await supabase
      .from("user_logs")
      .insert({
        user_id: user.id,
        entry_id: movieEntryId,
        // watch date; the old schema used created_at for this
        started_at: new Date().toISOString().slice(0, 10),
      })
      .select();

    setCreating(false);
    if (error) {
      console.error(error);
      return;
    }
    addLog(full.id, "", full, data[0].id);
    setEditing({ logId: data[0].id, entryId: movieEntryId, full });
  }

  function onClick(e) {
    e?.stopPropagation();
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    if (creating) return;
    createLog();
  }

  // Confirm: keep the log, go to the Log page with its title prefilled in the
  // search so the user lands right on what they just added.
  function onConfirm() {
    const title = editing?.full?.primaryTitle || "";
    setEditing(null);
    navigate("/log", { state: { searchTerm: title } });
  }

  // Cancel / click away: discard the log that was created up-front.
  async function onCancel() {
    const logId = editing?.logId;
    setEditing(null);
    if (!logId) return;
    removeLog(logId);
    const { error } = await supabase.from("user_logs").delete().eq("id", logId);
    if (error) console.error(error);
  }

  return (
    <>
      <div className="white-highlight">
        <img
          src="/images/addlog.png"
          className="addlog-icon addlog-log-icon"
          onClick={onClick}
          title="Add to log"
        ></img>
      </div>

      {editing && (
        <LogModal
          open={!!editing}
          movie={editing.full}
          logId={editing.logId}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </>
  );
}
