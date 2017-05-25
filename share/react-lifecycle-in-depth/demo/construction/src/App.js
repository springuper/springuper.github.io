import React, { Component } from 'react';
import Person from './Person';
import logo from './logo.svg';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { name: undefined };
  }

  onChange = e => this.setState({ name: e.target.value });

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to React</h2>
        </div>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
        <div>
          <input value={this.state.value} onChange={this.onChange} />
          <Person name="spring" />
        </div>
      </div>
    );
  }
}

export default App;
