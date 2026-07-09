function ReleaseAndRunTime({movie}) {
    const runtime = Number(movie.runtimeMinutes);

    // Unreleased title: show the full release date instead of a bare year.
    // releaseDate only exists on live TMDB objects, so stored movie_objects
    // simply keep showing the year.
    const release = movie.releaseDate ? new Date(movie.releaseDate) : null;
    const unreleased =
        release &&
        !Number.isNaN(release.getTime()) &&
        release.getTime() > Date.now();

    if (unreleased) {
        return (
            <p>
                {`Releases ${release.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                })}`}
            </p>
        );
    }

    return (
        <p>
            {movie.startYear ? (
                movie.endYear
                    ? `${movie.startYear} - ${movie.endYear}`
                    : `${movie.startYear}`
            ) : ""}

            {movie.type==="movie" && !(isNaN(runtime) || runtime <= 0) ? (
                <>
                    {" · "}
                    {Math.floor(runtime / 60) > 0 && `${Math.floor(runtime / 60)}h`}
                    {runtime % 60 > 0 && ` ${runtime % 60}m`}
                </>
            ):""}
        </p>
    );
}

export default ReleaseAndRunTime;
