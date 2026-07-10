import { makeNavHandlers } from "../../utils/navClick";

// Render a comma-separated people list where anyone with a person_id links to
// their person page.
export default function PeopleLinks({ people, navigate }) {
  return people.map((p, i) => (
    <span key={`${p.fullName}-${i}`}>
      {i > 0 ? ", " : ""}
      {p.person_id != null ? (
        <span
          className="person-inline-link"
          {...makeNavHandlers(navigate, `/person/${p.person_id}`)}
        >
          {p.fullName}
        </span>
      ) : (
        p.fullName
      )}
    </span>
  ));
}
