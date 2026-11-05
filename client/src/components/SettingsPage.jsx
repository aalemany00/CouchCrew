import ProfileForm from "./ProfileForm";

export default function SettingsPage() {
  return (
    <div className="page settings-page">
      <h1>Settings</h1>
      <ProfileForm />
      <h2>About</h2>
      <p className="room-tag">
        CouchCrew — watch movies and shows together with people who aren't in
        the room with you. Built for TCSS 490, Artifact 4.
      </p>
    </div>
  );
}
