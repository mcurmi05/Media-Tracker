import { useNavigate } from "react-router-dom";
import { makeNavHandlers } from "../../utils/navClick";
import "../../styles/media/PersonCard.css";

// Poster-shaped person tile for search results; opens the person page.
function PersonCard({ person }) {
  const navigate = useNavigate();
  const handlers = makeNavHandlers(navigate, `/person/${person.person_id}`);

  return (
    <div className="person-card" {...handlers}>
      <div className="person-card-photo">
        <img
          src={person.profile || "/images/placeholderimage.jpg"}
          alt={person.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/images/placeholderimage.jpg";
          }}
        />
      </div>
      <p className="person-card-name">{person.name}</p>
      {person.department && (
        <p className="person-card-dept">{person.department}</p>
      )}
    </div>
  );
}

export default PersonCard;
