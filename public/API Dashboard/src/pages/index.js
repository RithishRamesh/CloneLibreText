import React from 'react';
import FindReplace from "../components/FindReplace";
import DeadLinks from "../components/DeadLinks";
import HeaderFix from "../components/HeaderFix";
import ReactDOM from 'react-dom';

const target = document.createElement("div");
// noinspection JSValidateTypes
target.id = Math.random() * 100;
// noinspection XHTMLIncompatabilitiesJS
document.currentScript.parentNode.insertBefore(target, document.currentScript);


class Dashboard extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			panel: 'FindAndReplace'
		}
	}
	
	render() {
		return <div className={'CenterContainer'}>
			<div className="navigationBar">
				<select onChange={this.setPanel} defaultValue={this.state.panel}>
					{/*<option value={'Revisions'}>Revision Log</option>*/}
					<option value={'FindAndReplace'}>Find and Replace</option>
					<option value={'DeadLinks'}>Dead link killer</option>
					<option value={'HeaderFix'}>Header Fixer</option>
				</select>
			</div>
			{this.getPanel()}
		</div>
	}
	
	getPanel() {
		switch (this.state.panel) {
			case "Revisions":
				return null;
			case "FindAndReplace":
				return <FindReplace/>;
			case "DeadLinks":
				return <DeadLinks/>;
			case "HeaderFix":
				return <HeaderFix/>;
		}
	}
	
	setPanel = (event) => {
		this.setState({panel: event.target.value});
	}
	
}


ReactDOM.render(<Dashboard/>, target);