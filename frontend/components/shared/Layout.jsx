import React from "react";

// Exemple de styles CSS (vous pouvez modifier ou supprimer cette importation si vous n'utilisez pas de fichiers CSS spécifiques)
//import "@/styles/Layout.css"; // Assurez-vous que le chemin est correct

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <header className="layout-header">
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </nav>
      </header>
      <main className="layout-main">{children}</main>
      <footer className="layout-footer">
        <p>&copy; {new Date().getFullYear()} My Website. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Layout;
