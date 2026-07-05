import { useState } from "react";
import PosterEditModal from "../media/PosterEditModal";
import { useCovers } from "../../contexts/UserCoversContext";

// A book cover with the same hover-to-change behaviour as movie posters. The
// picked cover is a per-user override (applies everywhere that user sees the
// book). Cover options come from Hardcover editions. Editing is only offered
// when we have both the media entry id and a hardcover id to look covers up.
export default function EditableBookCover({
  entryId,
  hardcoverId,
  title,
  coverImage,
  imgClassName = "rating-poster",
  wrapperClassName = "poster-wrapper",
  imgProps = {},
  alt,
}) {
  const { coverFor } = useCovers();
  const [showEdit, setShowEdit] = useState(false);
  const src =
    coverFor(entryId) || coverImage || "/images/placeholderimage.jpg";
  const editable = entryId != null && hardcoverId != null;

  return (
    <div className={`${wrapperClassName}${editable ? " poster-editable" : ""}`}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/images/placeholderimage.jpg";
        }}
        {...imgProps}
      />
      {editable && (
        <button
          type="button"
          className="poster-edit-overlay"
          title="Change cover"
          onClick={(e) => {
            e.stopPropagation();
            setShowEdit(true);
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
      )}
      {editable && showEdit && (
        <PosterEditModal
          open
          entryId={entryId}
          mediaType="book"
          hardcoverId={hardcoverId}
          title={title}
          currentImage={coverImage}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
