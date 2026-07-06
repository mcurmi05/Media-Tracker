import "../../styles/media/CastList.css"
import { useNavigate } from "react-router-dom";
import ScrollStrip from "../layout/ScrollStrip";
import { makeNavHandlers } from "../../utils/navClick";

function CastList({ movie }) {
  const navigate = useNavigate();
  return (
    <div className="container-cast-main">
        <p className="list-title-cast">Cast & Crew</p>
        <ScrollStrip className="cast-list-container">
        {movie.cast.filter(castMember => castMember.job === "actor" || castMember.job === "actress").map((castMember, index) => (
            <div
              className={`cast-member-container${castMember.person_id != null ? " cast-member-clickable" : ""}`}
              key={index}
              {...(castMember.person_id != null
                ? makeNavHandlers(navigate, `/person/${castMember.person_id}`)
                : {})}
            >
                <img src={castMember.primaryImage ? `${castMember.primaryImage}`: "/images/placeholderimage.jpg"} className="cast-image"/>
                <p className="cast-member-fullname">{castMember.fullName}</p>
                <p className="cast-member-characters">{castMember.characters && castMember.characters.length > 0 ? castMember.characters.join(", ") : ""}</p>
            </div>
            ))}
        </ScrollStrip>
    </div>
  );
}

export default CastList;
