import { Pencil } from "lucide-react";
import ListComponent from "./ListComponent";
import AddToList from "./AddToList";
import PosterEditModal from "../media/PosterEditModal";
import "../../styles/pages/Rating.css";
import "../../styles/common/LogComponent.css";
import { supabase } from "../../services/supabase-client";
import { useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useLogs } from "../../contexts/UserLogsContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCallback, useRef } from "react";
import { useEffect } from "react";
import { Dialog } from "./ReactDayPicker";
import SeasonEpisodes from "../media/SeasonEpisodes";
import { getMovieById } from "../../services/api";
import { getWatchStatus, saveWatchStatus } from "../../services/watchStatus";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 520,
  bgcolor: "#1a1a1a",
  color: "white",
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  fontWeight: "bold",
};

export default function LogComponent({
  log_id,
  movie,
  logtext,
  created_at,
  movie_end_date,
}) {
  const [visible, setVisible] = useState(true);
  const {
    removeLog,
    updateLog,
    updateDate,
    userLogs,
    addSeason,
    updateSeasonDate,
    removeSeasonAt,
    setSeasonFinished,
    setSeasonDnf,
    patchLog,
  } = useLogs();
  const [showRemoveSeasonModal, setShowRemoveSeasonModal] = useState(false);
  const [seasonToRemoveIndex, setSeasonToRemoveIndex] = useState(null);
  const [showUndoSeasonModal, setShowUndoSeasonModal] = useState(false);
  const [undoSeasonIndex, setUndoSeasonIndex] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPosterEdit, setShowPosterEdit] = useState(false);

  const [text, setText] = useState(logtext);
  // Note is optional. Collapsed by default; pencil opens the editor.
  const [editingNote, setEditingNote] = useState(false);
  const debounceTimeout = useRef(null);

  const [saving, setSaving] = useState(false);
  const [textEdited, setTextEdited] = useState(false);

  const textareaRef = useRef(null);

  const { user } = useAuth();

  // --- Optional per-episode watch tracking (Log page) ---
  // Stored in the separate `watch_status` table, independent of the log's own
  // season dates. Loaded lazily the first time a user expands a season.
  const [expandedSeasons, setExpandedSeasons] = useState({});
  const [showAddSeasonModal, setShowAddSeasonModal] = useState(false);
  const [watchStatus, setWatchStatus] = useState({});
  const [watchStatusReady, setWatchStatusReady] = useState(false);
  // Map of season_number -> episodes[] fetched from TMDB on first expand.
  const [seasonsMeta, setSeasonsMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const isTV =
    movie &&
    (movie.type?.toLowerCase?.().includes("tv") ||
      (movie.titleType &&
        String(movie.titleType).toLowerCase().includes("tv")) ||
      movie.episodes);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "100px";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [text]);

  async function handleDateChange(newDate) {
    const isoDate = newDate.toISOString();
    setSaving(true);
    const { error } = await supabase
      .from("user_logs")
      .update({ started_at: isoDate })
      .eq("id", log_id);

    if (!error) {
      updateDate(log_id, isoDate);
      // Setting a real date clears the unknown flag.
      patchLog(log_id, { date_unknown: false });
      setTimeout(() => setSaving(false), 1200);
    } else {
      setSaving(false);
      alert("Failed to save date. Please try again.");
      console.error("Error updating date:", error);
    }
  }

  // Mark the watch date as unknown (null started_at). The card then shows a
  // "Date unknown" chip instead of a date; clicking it sets a real date.
  async function handleDateUnknown() {
    setSaving(true);
    const { error } = await supabase
      .from("user_logs")
      .update({ started_at: null })
      .eq("id", log_id);
    if (!error) {
      patchLog(log_id, { date_unknown: true });
      setTimeout(() => setSaving(false), 1200);
    } else {
      setSaving(false);
      console.error("Error setting date unknown:", error);
    }
  }

  const liveLog = userLogs.find((l) => l.id === log_id);
  const movieEndDate = liveLog?.movie_end_date ?? movie_end_date;
  const isMultiDay = !!liveLog?.multi_day;
  const dateUnknown = !!liveLog?.date_unknown;
  // Log-level DNF flag: marks a multi-day movie or a whole TV series as
  // abandoned. Shared `dnf` column on the logs table.
  const logDnf = !!liveLog?.dnf;

  // The movies_and_tv_entries row id this log points at - the key the separate
  // per-episode watch_status is stored against.
  const movieEntryId = liveLog?.movie_entry_id ?? null;

  // Fetch the show's season/episode metadata from TMDB once per mounted log.
  // Used both to render the expanded episode strips and to know which season
  // numbers actually exist when adding a season.
  const loadSeasonsMeta = useCallback(async () => {
    if (seasonsMeta || metaLoading || movie?.tmdb_id == null) return;
    setMetaLoading(true);
    try {
      const detail = await getMovieById(movie.media_type, movie.tmdb_id);
      const map = {};
      (detail?.seasons || []).forEach((s) => {
        map[s.season_number] = s.episodes || [];
      });
      setSeasonsMeta(map);
    } catch (err) {
      console.error("Failed to load episode metadata:", err);
      setSeasonsMeta({});
    } finally {
      setMetaLoading(false);
    }
  }, [seasonsMeta, metaLoading, movie?.tmdb_id, movie?.media_type]);

  // Lazy-load the per-episode watch status and episode metadata the first time a
  // season is expanded.
  const ensureEpisodeData = useCallback(async () => {
    if (user && movieEntryId && !watchStatusReady) {
      const status = await getWatchStatus(user.id, movieEntryId);
      setWatchStatus(status || {});
      setWatchStatusReady(true);
    }
    loadSeasonsMeta();
  }, [user, movieEntryId, watchStatusReady, loadSeasonsMeta]);

  function toggleSeasonExpand(seasonNumber) {
    setExpandedSeasons((prev) => ({
      ...prev,
      [seasonNumber]: !prev[seasonNumber],
    }));
    ensureEpisodeData();
  }

  // Open the "add a season" picker, loading the TMDB season list first.
  function handleAddSeasonClick() {
    loadSeasonsMeta();
    setShowAddSeasonModal(true);
  }

  const isEpisodeWatched = (seasonNumber, epNum) =>
    (watchStatus[seasonNumber] || []).includes(epNum);

  const episodeWatchedDate = (seasonNumber, epNum) =>
    watchStatus._dates?.[seasonNumber]?.[epNum] || null;

  // Persist the whole status object (keyed on user + movie entry), independent
  // of the log itself.
  const persistWatchStatus = (next) => {
    if (user && movieEntryId) saveWatchStatus(user.id, movieEntryId, next);
  };

  // Toggle an episode watched/unwatched. The watched date stays null - recording
  // when it was watched is optional - so watching just flips the flag. Unwatching
  // also clears any date the user had added.
  function toggleEpisodeWatched(seasonNumber, epNum) {
    setWatchStatus((prev) => {
      const set = new Set(prev[seasonNumber] || []);
      const dates = { ...(prev._dates || {}) };
      const seasonDates = { ...(dates[seasonNumber] || {}) };
      if (set.has(epNum)) {
        set.delete(epNum);
        delete seasonDates[epNum];
      } else {
        set.add(epNum);
        // leave the watched date null; the user can add one later if they want
      }
      const next = { ...prev };
      if (set.size === 0) delete next[seasonNumber];
      else next[seasonNumber] = Array.from(set).sort((a, b) => a - b);
      if (Object.keys(seasonDates).length === 0) delete dates[seasonNumber];
      else dates[seasonNumber] = seasonDates;
      if (Object.keys(dates).length === 0) delete next._dates;
      else next._dates = dates;
      persistWatchStatus(next);
      return next;
    });
  }

  // Change the watched date for an already-watched episode.
  function setEpisodeWatchedDate(seasonNumber, epNum, isoDate) {
    setWatchStatus((prev) => {
      const dates = { ...(prev._dates || {}) };
      dates[seasonNumber] = { ...(dates[seasonNumber] || {}), [epNum]: isoDate };
      const next = { ...prev, _dates: dates };
      persistWatchStatus(next);
      return next;
    });
  }

  // Clear an episode's watched date back to none (the episode stays watched).
  function clearEpisodeWatchedDate(seasonNumber, epNum) {
    setWatchStatus((prev) => {
      if (!prev._dates?.[seasonNumber]?.[epNum]) return prev;
      const dates = { ...(prev._dates || {}) };
      const seasonDates = { ...(dates[seasonNumber] || {}) };
      delete seasonDates[epNum];
      if (Object.keys(seasonDates).length === 0) delete dates[seasonNumber];
      else dates[seasonNumber] = seasonDates;
      const next = { ...prev };
      if (Object.keys(dates).length === 0) delete next._dates;
      else next._dates = dates;
      persistWatchStatus(next);
      return next;
    });
  }

  // Persist a partial update to this movie log, then sync local state. Local
  // state still uses the legacy field names; map them to the unified columns
  // for the write (movie_end_date -> ended_at) while keeping the local patch
  // in the old shape.
  async function persistLog(updates, failMsg) {
    setSaving(true);
    const dbUpdates = { ...updates };
    if ("movie_end_date" in dbUpdates) {
      dbUpdates.ended_at = dbUpdates.movie_end_date;
      delete dbUpdates.movie_end_date;
    }
    const { error } = await supabase
      .from("user_logs")
      .update(dbUpdates)
      .eq("id", log_id);

    if (!error) {
      patchLog(log_id, updates);
      setTimeout(() => setSaving(false), 1200);
    } else {
      setSaving(false);
      alert(failMsg);
      console.error(failMsg, error);
    }
  }

  // Save the multi-day end date for a movie log (also clears any DNF state)
  function handleEndDateChange(newDate) {
    return persistLog(
      { movie_end_date: newDate.toISOString(), dnf: false },
      "Failed to save date. Please try again.",
    );
  }

  // Clear the multi-day end date, leaving the movie in-progress
  function handleClearEndDate() {
    return persistLog(
      { movie_end_date: null },
      "Failed to clear end date. Please try again.",
    );
  }

  // Mark the multi-day movie as DNF, or undo it
  function handleMovieDnf(value) {
    return persistLog(
      value ? { dnf: true, movie_end_date: null } : { dnf: false },
      "Failed to update DNF state. Please try again.",
    );
  }

  // Mark the whole TV series as DNF, or undo it. Unlike a movie DNF this
  // leaves every season's dates intact - the user is abandoning the show,
  // not erasing the seasons they did finish.
  function handleSeriesDnf(value) {
    return persistLog(
      { dnf: !!value },
      "Failed to update DNF state. Please try again.",
    );
  }

  // Toggle multi-day movie log mode on/off. Enabling leaves the movie
  // in-progress (no end date); disabling clears the end date and DNF state.
  function handleMultiDayChange(enabled) {
    return persistLog(
      enabled
        ? { multi_day: true, movie_end_date: null }
        : { multi_day: false, movie_end_date: null, dnf: false },
      "Failed to update multi-day mode. Please try again.",
    );
  }

  async function confirmDeleteLog() {
    const { error } = await supabase.from("user_logs").delete().eq("id", log_id);
    removeLog(log_id);
    if (error) {
      console.error("Error deleting log:", error);
    } else {
      setVisible(false);
    }
    setShowDeleteModal(false);
  }

  useEffect(() => {
    if (!visible || !textEdited) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    setSaving(true);
    debounceTimeout.current = setTimeout(async () => {
      const { error } = await supabase
        .from("user_logs")
        .update({ log: text })
        .eq("id", log_id);
      if (!error) {
        updateLog(log_id, text);
        setSaving(false);
        setTextEdited(false);
        console.log("Updated log");
      } else {
        setSaving(false);
        console.error("Error updating log:", error);
      }
    }, 2000);
    return () => clearTimeout(debounceTimeout.current);
  }, [text, visible, created_at, movie, textEdited, updateLog, log_id]);

  if (!visible) return null;

  // Seasons that exist per TMDB but haven't been logged in this entry yet -
  // offered when adding a season instead of assuming the next sequential number.
  const loggedSeasonNumbers = new Set(
    (liveLog?.season_info || []).map((s) => s.season),
  );
  const tmdbSeasonNumbers = seasonsMeta
    ? Object.keys(seasonsMeta)
        .map(Number)
        .sort((a, b) => a - b)
    : [];
  const availableSeasonNumbers = tmdbSeasonNumbers.filter(
    (n) => !loggedSeasonNumbers.has(n),
  );

  // Action buttons offered inside the movie date pickers. DNF can only be
  // set from here; it is undone by clicking the red DNF badge.
  const movieActions = [
    {
      label: isMultiDay
        ? "Set to single-day movie log"
        : "Set to multi-day movie log",
      onClick: () => handleMultiDayChange(!isMultiDay),
    },
    { label: "Date unknown", onClick: handleDateUnknown },
  ];
  if (isMultiDay) {
    movieActions.push({
      label: "Clear end date",
      onClick: handleClearEndDate,
      disabled: !movieEndDate,
    });
    if (!logDnf) {
      movieActions.push({
        label: "DNF",
        onClick: () => handleMovieDnf(true),
        danger: true,
      });
    }
  }

  const dateLabelStyle = { fontSize: "0.9rem", color: "#ccc" };

  // Inline "add note" shown next to the date when no note exists yet, so an
  // empty note takes no vertical space.
  const noteEmpty = !editingNote && !(text && text.trim());
  const addNoteBtn = noteEmpty ? (
    <button
      type="button"
      className="log-note-add"
      onClick={() => setEditingNote(true)}
    >
      <Pencil className="size-4" />
      Add note
    </button>
  ) : null;

  return (
    //i am fully aware of how lazy this is
    <div className="log-rating-wrapper">
      <ListComponent
        key={log_id}
        movie_object={movie}
        ratingDate="today"
        betweenSlot={<AddToList movie={movie} />}
        posterEditable={movie?.tmdb_id != null}
        onEditPoster={() => setShowPosterEdit(true)}
      ></ListComponent>
      {showPosterEdit && (
        <PosterEditModal
          open={showPosterEdit}
          movie={movie}
          logId={log_id}
          entryId={movieEntryId}
          onClose={() => setShowPosterEdit(false)}
        />
      )}
      {!isTV && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "26px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isMultiDay && <span style={dateLabelStyle}>Started:</span>}
            {dateUnknown ? (
              <button
                type="button"
                className="log-date-unknown"
                onClick={() => handleDateChange(new Date())}
                title="Set a date"
              >
                Date unknown
              </button>
            ) : (
              <Dialog
                initialDate={created_at ? new Date(created_at) : new Date()}
                onDateChange={handleDateChange}
                showWeekday={true}
                dateColor="#fff"
                iconGap="10px"
                minWidth="auto"
                extraActions={movieActions}
              />
            )}
          </div>
          {addNoteBtn}

          {isMultiDay &&
            (logDnf ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={dateLabelStyle}>Finished:</span>
                <span
                  className="dnf-badge"
                  onClick={() => handleMovieDnf(false)}
                  title="Undo did not finish"
                >
                  DNF
                </span>
              </div>
            ) : movieEndDate ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={dateLabelStyle}>Finished:</span>
                <Dialog
                  key={movieEndDate}
                  initialDate={new Date(movieEndDate)}
                  onDateChange={handleEndDateChange}
                  showWeekday={true}
                  dateColor="#fff"
                  iconGap="10px"
                  minWidth="auto"
                  extraActions={movieActions}
                />
              </div>
            ) : (
              <button
                onClick={() => handleEndDateChange(new Date())}
                aria-label="Mark as finished"
                title="Mark as finished"
                style={{
                  background: "transparent",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  padding: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <img
                  src="/images/watched.png"
                  alt="Mark as finished"
                  style={{
                    width: 20,
                    height: 20,
                    transform: "translateY(-2px)",
                  }}
                />
              </button>
            ))}
        </div>
      )}

      {/* Seasons UI for TV/mini-series entries */}
      {movie &&
        (movie.type?.toLowerCase?.().includes("tv") ||
          (movie.titleType &&
            String(movie.titleType).toLowerCase().includes("tv")) ||
          movie.episodes) && (
          <div
            className="seasons-container"
            style={{ width: "100%", marginBottom: "12px", paddingLeft: "20px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <strong>Seasons</strong>
              <button
                onClick={handleAddSeasonClick}
                aria-label="Add season"
                title="Add season"
                className="season-button"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/images/plus.png"
                  alt="Add"
                  style={{ width: 16, height: 16 }}
                />
              </button>
              {addNoteBtn}
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {(userLogs.find((l) => l.id === log_id)?.season_info || []).map(
                (s, idx, arr) => {
                  const seasonNumber = s.season || idx + 1;
                  const seasonOpen = !!expandedSeasons[seasonNumber];
                  return (
                  <div
                    key={idx}
                    className="season-row"
                    onClick={() => toggleSeasonExpand(seasonNumber)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="season-left">
                      <div className="season-title">
                        <div className="season-label">
                          Season {seasonNumber}
                        </div>
                        {/* actions: undo/mark-finished and delete - sit to the right of label */}
                        <div
                          className="season-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!s.finished && !s.dnf && (
                            <button
                              onClick={() =>
                                setSeasonFinished(log_id, idx, true)
                              }
                              aria-label="Mark season finished"
                              title="Mark season finished"
                              className="season-button"
                              style={{
                                background: "transparent",
                                color: "white",
                                border: "none",
                                borderRadius: 4,
                                padding: "5px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <img
                                src="/images/watched.png"
                                alt="Watched"
                                style={{
                                  width: 20,
                                  height: 20,
                                  transform: "translateY(-2px)",
                                }}
                              />
                            </button>
                          )}
                          {s.finished && (
                            <button
                              onClick={() => {
                                setUndoSeasonIndex(idx);
                                setShowUndoSeasonModal(true);
                              }}
                              aria-label="Undo finished"
                              title="Undo finished"
                              className="season-button"
                              style={{
                                background: "transparent",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <img
                                src="/images/undo.png"
                                alt="Undo finished"
                                style={{ width: 16, height: 16 }}
                              />
                            </button>
                          )}
                          {/* show remove button only for the last season */}
                          {idx === arr.length - 1 && (
                            <img
                              src="/images/logdelete.png"
                              alt="Remove newest season"
                              title="Remove newest season"
                              onClick={() => {
                                setSeasonToRemoveIndex(idx);
                                setShowRemoveSeasonModal(true);
                              }}
                              style={{
                                width: 12,
                                height: 12,
                                cursor: "pointer",
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <div
                        className="season-dates-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="season-chunk">
                          <div
                            className="season-started-label"
                            style={{ fontSize: "0.9rem", color: "#ccc" }}
                          >
                            Started:
                          </div>
                          <Dialog
                            initialDate={
                              s.start_date ? new Date(s.start_date) : null
                            }
                            onDateChange={(d) =>
                              updateSeasonDate(
                                log_id,
                                idx,
                                "start_date",
                                d.toISOString(),
                              )
                            }
                            showWeekday={false}
                            dateColor="#fff"
                            iconGap="8px"
                            minWidth="110px"
                            extraActions={
                              // DNF the whole series from an in-progress last
                              // season - one with a start date but no finish
                              // date yet. A finished last season offers DNF
                              // from its "Finished:" picker instead.
                              idx === arr.length - 1 && !logDnf && !s.finished
                                ? [
                                    {
                                      label: "DNF",
                                      onClick: () => handleSeriesDnf(true),
                                      danger: true,
                                    },
                                  ]
                                : []
                            }
                          />
                        </div>

                        {s.finished && (
                          <div className="season-chunk">
                            <div
                              className="season-finished-label"
                              style={{ fontSize: "0.9rem", color: "#ccc" }}
                            >
                              Finished:
                            </div>
                            <Dialog
                              initialDate={
                                s.end_date
                                  ? new Date(s.end_date)
                                  : s.finished_at
                                    ? new Date(s.finished_at)
                                    : null
                              }
                              onDateChange={(d) =>
                                updateSeasonDate(
                                  log_id,
                                  idx,
                                  "end_date",
                                  d.toISOString(),
                                )
                              }
                              showWeekday={false}
                              dateColor="#fff"
                              iconGap="6px"
                              minWidth="120px"
                              extraActions={
                                // DNF the whole series from the last season's
                                // finish-date picker - only reachable once that
                                // season has an end date.
                                idx === arr.length - 1 && !logDnf
                                  ? [
                                      {
                                        label: "DNF",
                                        onClick: () => handleSeriesDnf(true),
                                        danger: true,
                                      },
                                    ]
                                  : []
                              }
                            />
                          </div>
                        )}

                        {/* Series DNF badge - sits next to the last season's
                            finished date once the whole show is marked DNF.
                            Click to undo. */}
                        {idx === arr.length - 1 && logDnf && (
                          <div className="season-chunk">
                            <span
                              className="dnf-badge"
                              onClick={() => handleSeriesDnf(false)}
                              title="This series is marked DNF - click to undo"
                            >
                              DNF
                            </span>
                          </div>
                        )}

                        {s.dnf && (
                          <div className="season-chunk">
                            <span
                              className="dnf-badge"
                              onClick={() => setSeasonDnf(log_id, idx, false)}
                              title="Undo did not finish"
                            >
                              DNF
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* expand to per-episode watch tracking (optional, kept
                        separate from the log's season dates) - far right */}
                    <button
                      type="button"
                      className={`season-expand-btn${
                        seasonOpen ? " open" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSeasonExpand(seasonNumber);
                      }}
                      aria-expanded={seasonOpen}
                      aria-label={seasonOpen ? "Hide episodes" : "Show episodes"}
                      title={seasonOpen ? "Hide episodes" : "Show episodes"}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 6l4 4 4-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {seasonOpen && (
                      <SeasonEpisodes
                        episodes={seasonsMeta ? seasonsMeta[seasonNumber] : null}
                        loading={metaLoading || !seasonsMeta}
                        seasonName={`Season ${seasonNumber}`}
                        canEdit={!!user}
                        isWatched={(epNum) =>
                          isEpisodeWatched(seasonNumber, epNum)
                        }
                        getDate={(epNum) =>
                          episodeWatchedDate(seasonNumber, epNum)
                        }
                        onToggle={(epNum) =>
                          toggleEpisodeWatched(seasonNumber, epNum)
                        }
                        onSetDate={(epNum, iso) =>
                          setEpisodeWatchedDate(seasonNumber, epNum, iso)
                        }
                        onClearDate={(epNum) =>
                          clearEpisodeWatchedDate(seasonNumber, epNum)
                        }
                      />
                    )}
                  </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      {(editingNote || (text && text.trim())) && (
        <textarea
          ref={textareaRef}
          className="log-input"
          value={text}
          autoFocus={editingNote}
          onBlur={() => {
            if (!text || !text.trim()) setEditingNote(false);
          }}
          onInput={(e) => {
            e.target.style.height = "100px";
            e.target.style.height = e.target.scrollHeight + "px";
            setText(e.target.value);
            //open to suggestions on a better way to do this lol
            setTextEdited(true);
          }}
        ></textarea>
      )}
      <img
        src="/images/logdelete.png"
        className="log-delete-icon"
        onClick={() => setShowDeleteModal(true)}
      ></img>
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        aria-labelledby="delete-log-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Are you sure you want to delete this log?
          </div>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setShowDeleteModal(false)}
              sx={{
                color: "white",
                borderColor: "#666",
                "&:hover": { borderColor: "#888" },
                fontWeight: "bold",
                textTransform: "none",
                "&.Mui-focusVisible": {
                  boxShadow: "none",
                  outline: "none",
                  borderColor: "#666",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={confirmDeleteLog}
              sx={{
                backgroundColor: "#ff0000ff",
                "&:hover": { backgroundColor: "#cc0000" },
                fontWeight: "bold",
                textTransform: "none",
                "&.Mui-focusVisible": {
                  boxShadow: "none",
                  outline: "none",
                  borderColor: "#ff0000ff",
                },
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Modal>
      <Modal
        open={showRemoveSeasonModal}
        onClose={() => setShowRemoveSeasonModal(false)}
        aria-labelledby="delete-season-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Are you sure you want to remove{" "}
            <span style={{ whiteSpace: "nowrap" }}>
              Season{" "}
              {seasonToRemoveIndex !== null
                ? liveLog?.season_info?.[seasonToRemoveIndex]?.season ??
                  seasonToRemoveIndex + 1
                : ""}
            </span>
            ?
          </div>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setShowRemoveSeasonModal(false)}
              sx={{
                color: "white",
                borderColor: "#666",
                fontWeight: "bold",
                textTransform: "none",
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (seasonToRemoveIndex !== null)
                  removeSeasonAt(log_id, seasonToRemoveIndex);
                setShowRemoveSeasonModal(false);
                setSeasonToRemoveIndex(null);
              }}
              sx={{
                backgroundColor: "#ff0000ff",
                fontWeight: "bold",
                textTransform: "none",
              }}
            >
              Remove
            </Button>
          </Box>
        </Box>
      </Modal>
      <Modal
        open={showUndoSeasonModal}
        onClose={() => setShowUndoSeasonModal(false)}
        aria-labelledby="undo-season-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Are you sure you want to unwatch{" "}
            <span style={{ whiteSpace: "nowrap" }}>
              Season{" "}
              {undoSeasonIndex !== null
                ? liveLog?.season_info?.[undoSeasonIndex]?.season ??
                  undoSeasonIndex + 1
                : ""}
            </span>
            ?
          </div>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              variant="outlined"
              onClick={() => setShowUndoSeasonModal(false)}
              sx={{
                color: "white",
                borderColor: "#666",
                fontWeight: "bold",
                textTransform: "none",
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (undoSeasonIndex !== null)
                  setSeasonFinished(log_id, undoSeasonIndex, false);
                setShowUndoSeasonModal(false);
                setUndoSeasonIndex(null);
              }}
              sx={{
                backgroundColor: "#ff0000ff",
                fontWeight: "bold",
                textTransform: "none",
              }}
            >
              Unwatch
            </Button>
          </Box>
        </Box>
      </Modal>
      <Modal
        open={showAddSeasonModal}
        onClose={() => setShowAddSeasonModal(false)}
        aria-labelledby="add-season-modal-title"
      >
        <Box sx={modalStyle}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
              fontWeight: "bold",
            }}
          >
            Add a season
          </div>
          {metaLoading && !seasonsMeta ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "8px 0",
              }}
            >
              <span className="season-eps-spinner" aria-hidden="true" />
            </div>
          ) : availableSeasonNumbers.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1.5,
                justifyContent: "center",
              }}
            >
              {availableSeasonNumbers.map((n) => (
                <Button
                  key={n}
                  variant="outlined"
                  onClick={() => {
                    addSeason(log_id, n);
                    setShowAddSeasonModal(false);
                  }}
                  sx={{
                    color: "white",
                    borderColor: "#666",
                    "&:hover": { borderColor: "#888" },
                    fontWeight: "bold",
                    textTransform: "none",
                    minWidth: 96,
                  }}
                >
                  Season {n}
                </Button>
              ))}
            </Box>
          ) : tmdbSeasonNumbers.length > 0 ? (
            <div style={{ textAlign: "center", color: "#bbb" }}>
              Every season has already been logged.
            </div>
          ) : (
            // No TMDB season data - fall back to adding the next number.
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Button
                variant="outlined"
                onClick={() => {
                  addSeason(log_id);
                  setShowAddSeasonModal(false);
                }}
                sx={{
                  color: "white",
                  borderColor: "#666",
                  "&:hover": { borderColor: "#888" },
                  fontWeight: "bold",
                  textTransform: "none",
                }}
              >
                Add next season
              </Button>
            </Box>
          )}
        </Box>
      </Modal>
      {saving && (
        <div style={{ fontSize: "0.9rem", color: "#888", marginTop: "4px" }}>
          <p>Saving, please don't refresh or click away...</p>
        </div>
      )}
    </div>
  );
}
