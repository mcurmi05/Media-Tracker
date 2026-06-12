import "../styles/CastList.css"
import { useCallback, useEffect, useRef, useState } from "react";

function CastList({ movie }) {
  const listRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    // Translate vertical wheel scrolling into horizontal movement of the strip.
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
      el.removeEventListener("wheel", onWheel);
    };
  }, [updateArrows, movie]);

  const scrollByDir = (dir) => {
    const el = listRef.current;
    if (!el) return;
    const amount = Math.max(220, el.clientWidth * 0.8);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div className="container-cast-main">
        <p className="list-title-cast">Cast & Crew</p>
        <div className="cast-strip-wrap">
        {canLeft && (
          <button
            type="button"
            className="cast-strip-arrow cast-strip-arrow-left"
            onClick={() => scrollByDir(-1)}
            aria-label="Scroll left"
          >
            {String.fromCharCode(0x2039)}
          </button>
        )}
        <div className="cast-list-container" ref={listRef}>

        {movie.cast.filter(castMember => castMember.job === "actor" || castMember.job === "actress").map((castMember, index) => (
            <div className="cast-member-container" key={index}>
                <img src={castMember.primaryImage ? `${castMember.primaryImage}`: "/placeholderimage.jpg"} className="cast-image"/>
                <p className="cast-member-fullname">{castMember.fullName}</p>
                <p className="cast-member-characters">{castMember.characters && castMember.characters.length > 0 ? castMember.characters.join(", ") : ""}</p>
            </div>
            ))}
        </div>
        {canRight && (
          <button
            type="button"
            className="cast-strip-arrow cast-strip-arrow-right"
            onClick={() => scrollByDir(1)}
            aria-label="Scroll right"
          >
            {String.fromCharCode(0x203a)}
          </button>
        )}
        </div>
    </div>
  );
}

export default CastList;
