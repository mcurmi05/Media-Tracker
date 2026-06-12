import "../styles/CastList.css"
import { useEffect, useRef } from "react";

function CastList({ movie }) {
  const listRef = useRef(null);

  // Translate vertical wheel scrolling into horizontal movement of the strip.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="container-cast-main">
        <p className="list-title-cast">Cast & Crew</p>
        <div className="cast-list-container" ref={listRef}>

        {movie.cast.filter(castMember => castMember.job === "actor" || castMember.job === "actress").map((castMember, index) => (
            <div className="cast-member-container" key={index}>
                <img src={castMember.primaryImage ? `${castMember.primaryImage}`: "/placeholderimage.jpg"} className="cast-image"/>
                <p className="cast-member-fullname">{castMember.fullName}</p>
                <p className="cast-member-characters">{castMember.characters && castMember.characters.length > 0 ? castMember.characters.join(", ") : ""}</p>
            </div>
            ))}
        </div>
    </div>
  );
}

export default CastList;
