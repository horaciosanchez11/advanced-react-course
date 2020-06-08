import App, {Container} from 'next/app';
import Page from '../components/Page';
import {ApolloProvider} from 'react-apollo';
import withData from '../lib/withData';

class MyApp extends App {
	// this method runs first, it comes from nextJS; it runs before the initial render happens
	static async getInitialProps({Component, ctx}) {
		let pageProps = {};
		if (Component.getInitialProps) {
			pageProps = await  Component.getInitialProps(ctx);
		}
		// this exposes the query to the user
		pageProps.query = ctx.query;
		// you expose via props with this
		return {pageProps};
	}

	render() {
		const {Component, apollo, pageProps} = this. props;

		return(
			<Container>
				<ApolloProvider client={apollo}>
					<Page>
						<Component />
					</Page>
				</ApolloProvider>
			</Container>
		)
	}
}

export default withData(MyApp);