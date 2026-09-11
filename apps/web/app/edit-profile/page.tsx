import Link from "next/link";
import { Header } from "../components/header";
export default function EditProfile() {
  return (
    <main className="app-shell">
      <Header title="Edit profile" back="/profile" />
      <form className="profile-form">
        <div className="profile-avatar large-avatar">AO</div>
        <button type="button" className="text-link">
          Change photo
        </button>
        <label>
          Full name
          <input defaultValue="Amara Okafor" />
        </label>
        <label>
          Email address
          <input type="email" defaultValue="amara@example.com" />
        </label>
        <label>
          Phone number
          <input type="tel" defaultValue="+234 803 123 4567" />
        </label>
        <label>
          Bio
          <textarea defaultValue="Finding beautiful things, one cart at a time." />
        </label>
        <Link href="/profile" className="dark-button">
          Save changes
        </Link>
      </form>
    </main>
  );
}
