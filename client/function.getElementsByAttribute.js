function getElementsByAttribute(Attribute, Value) {
	var Elements = [];
	var scanElementNodes = function(Element) {
		var Nodes = Element.childNodes;
		var i, j = Nodes.length, Node;
		var i2, j2, Attributes, Attribute2;
		for ( i = 0; i < j; i++ ) {
			Node = Element.childNodes[i];
			if (Node.nodeType == 1) {
				Attributes = Node.attributes;
				j2 = Attributes.length;
				for (i2=0; i2<j2; i2++) {
					Attribute2 = Attributes[i2];
					if (Attribute2.nodeName == Attribute && Attribute2.nodeValue == Value) {
						Elements.push(Node);
						break;
					}
				}
				scanElementNodes(Node);
			}
		}
	}
	scanElementNodes(this);
	return Elements;
}
HTMLElement.prototype.getElementsByAttribute = getElementsByAttribute;
document.getElementsByAttribute = getElementsByAttribute;
