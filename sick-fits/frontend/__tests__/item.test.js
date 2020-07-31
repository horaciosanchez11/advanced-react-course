import ItemComponent from '../components/Item';
import {shallow} from 'enzyme';

const fakeItem = {
	id:'ABC123',
	title: 'An Item',
	price: 5000,
	description: 'This is an item',
	image: 'dog.jpg',
	largeImage: 'largeDog.jpg'
}

describe('<Item/>', () => {
	const wrapper = shallow(<ItemComponent item={fakeItem} />);

	it ('renders the image properly', () => {
		const img = wrapper.find('img');
		expect(img.props().src).toBe(fakeItem.image);
		expect(img.props().alt).toBe(fakeItem.title);
	});
	
	it ('renders price tag and title', () => {		
		const PriceTage = wrapper.find('PriceTag');
		expect(PriceTage.children().text()).toBe('$50');
		
		expect(wrapper.find('Title a').text()).toBe(fakeItem.title);		
	});

	it ('renders the buttons properly', () => {
		const buttonList = wrapper.find('.buttonList');
		console.log(buttonList.debug());
		expect(buttonList.children()).toHaveLength(3);
		expect(buttonList.find('Link')).toHaveLength(1);
		expect(buttonList.find('Link').exists()).toBeTruthy();
	});
});