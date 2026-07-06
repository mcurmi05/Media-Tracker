import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPersonById } from "../services/api";
import ScrollStrip from "../components/layout/ScrollStrip";
import Loader from "../components/layout/Loader";
import { makeNavHandlers } from "../utils/navClick";
import "../styles/pages/Person.css";

// Crew departments shown first (and in this order); anything else follows.
const DEPT_ORDER = ["Directing", "Writing", "Production"];

function TitleStrip({ title, items, navigate }) {
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
              src={it.primaryImage || "/images/placeholderimage.jpg"}
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

function Person() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
            <p className="person-bio">{person.biography}</p>
          )}
        </div>
      </div>

      <TitleStrip title="Known For" items={person.knownFor} navigate={navigate} />
      <TitleStrip title="Acting" items={person.acting} navigate={navigate} />
      {deptNames.map((dept) => (
        <TitleStrip
          key={dept}
          title={dept}
          items={person.crewByDept[dept]}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

export default Person;
