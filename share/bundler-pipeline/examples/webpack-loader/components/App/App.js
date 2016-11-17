import React from 'react';
import styles from './App.css';

var TopNav;
if (process.env.BROWSER) {
  TopNav = require('../TopNav/TopNav');
}

const App = React.createClass({
  render() {
    return (
      <div>
        <div className={styles.contentWrapper}>
          content
        </div>
      </div>
    );
  }
});

export default App;
