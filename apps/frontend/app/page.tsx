import { Sidebar } from "@repo/ui/sidebar";
import { Map } from "@repo/ui/map";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Sidebar>
        <p>Menu items coming soon.</p>
      </Sidebar>
      <Map />
    </div>
  );
}
