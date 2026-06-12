function ReleaseAndRunTime({movie}) {
    const runtime = Number(movie.runtimeMinutes);

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