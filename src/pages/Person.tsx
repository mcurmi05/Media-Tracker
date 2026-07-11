import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPersonById } from "../services/api";
import ScrollStrip from "../components/layout/ScrollStrip";
import Loader from "../components/layout/Loader";
import { makeNavHandlers } from "../utils/navClick";
import { useCovers } from "../contexts/UserCoversContext";
import "../styles/pages/Person.css";

// Crew departments shown first (and in this order); anything else follows.
const DEPT_ORDER = ["Directing", "Writing", "Production"];

// TMDB names credit groups by activity ("Directing"); show the person's role
// instead ("Director"). Falls back to the raw department for anything unmapped.
const DEPT_LABEL = {
  Directing: "Director",
  Writing: "Writer",
  Production: "Producer",
  Editing: "Editor",
  Camera: "Cinematographer",
  Sound: "Sound",
  Art: "Art",
  Lighting: "Lighting",
  "Visual Effects": "Visual Effects",
  "Costume & Make-Up": "Costume & Make-Up",
  Crew: "Crew",
};

function TitleStrip({ title, items, navigate, coverForTmdb }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="person-section">
      <h3 className="person-section-title">{title}</h3>
      <ScrollStrip className="person-strip" wrapClassName="person-strip-wrap">
        {items.map((it) => (
          <div
            key={`${it.media_type}-${it.tmdb_id}-${it.role || ""}`}
            className="person-credit"
            {...makeNavHandlers(
              navigate,
              `/mediadetails/${it.media_type}/${it.tmdb_id}`,
            )}
          >
            <img
              className="person-credit-poster"
              src={
                coverForTmdb(it.media_type, it.tmdb_id) ||
                it.primaryImage ||
                "/images/placeholderimage.jpg"
              }
              alt={it.primaryTitle}
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/images/placeholderimage.jpg";
              }}
            />
            <span className="person-credit-title">{it.primaryTitle}</span>
            <span className="person-credit-sub">
              {it.startYear || ""}
              {it.startYear && it.role ? " · " : ""}
              {it.role || ""}
            </span>
          </div>
        ))}
      </ScrollStrip>
    </div>
  );
}

// Bios longer than this get collapsed behind a "Show more" toggle so the
// credit strips aren't pushed below the fold.
const BIO_COLLAPSE_CHARS = 400;

function Person() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { coverForTmdb } = useCovers();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bioOpen, setBioOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getPersonById(personId)
      .then((data) => {
        if (live) setPerson(data);
      })
      .catch(() => {
        if (live) setError("Failed to load person");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [personId]);

  if (loading) return <Loader />;
  if (error) return <div className="error">{error}</div>;
  if (!person) return <div className="error">Person not found</div>;

  const deptNames = Object.keys(person.crewByDept || {}).sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a);
    const ib = DEPT_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="person-page">
      <div className="person-header">
        <img
          className="person-photo"
          src={person.profile || "/images/placeholderimage.jpg"}
          alt={person.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/images/placeholderimage.jpg";
          }}
        />
        <div className="person-header-info">
          <h1 className="person-name">{person.name}</h1>
          {person.department && (
            <p className="person-meta">{person.department}</p>
          )}
          {(person.birthday || person.place_of_birth) && (
            <p className="person-meta">
              {person.birthday || ""}
              {person.birthday && person.place_of_birth ? " · " : ""}
              {person.place_of_birth || ""}
            </p>
          )}
          {person.biography && (
            <>
              <p
                className={`person-bio${
                  person.biography.length > BIO_COLLAPSE_CHARS && !bioOpen
                    ? " person-bio-clamped"
                    : ""
                }`}
              >
                {person.biography}
              </p>
              {person.biography.length > BIO_COLLAPSE_CHARS && (
                <button
                  type="button"
                  className="person-bio-toggle"
                  onClick={() => setBioOpen((v) => !v)}
                >
                  {bioOpen ? "Show less" : "Show more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <TitleStrip
        title="Known For"
        items={person.knownFor}
        navigate={navigate}
        coverForTmdb={coverForTmdb}
      />
      <TitleStrip
        title="Actor"
        items={person.acting}
        navigate={navigate}
        coverForTmdb={coverForTmdb}
      />
      {deptNames.map((dept) => (
        <TitleStrip
          key={dept}
          title={DEPT_LABEL[dept] || dept}
          items={person.crewByDept[dept]}
          navigate={navigate}
          coverForTmdb={coverForTmdb}
        />
      ))}
    </div>
  );
}

export default Person;
